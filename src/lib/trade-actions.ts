"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import type { ActionResult } from "./actions";
import { requireUser } from "./auth";
import { allocate, toAllocSources } from "./allocate";
import { BILL_MAX_ROWS, bangkokDay } from "./bill";
import { slipIdsSchema, syncAttachments } from "./attachments";
import { partySchema, upsertCustomer } from "./customers";
import { getSourceOptions, getStockSources } from "./trade-queries";

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function revalidateTrade() {
  for (const p of ["/dashboard", "/sales", "/lots", "/reports", "/bills"]) revalidatePath(p);
}

/** Today's entries keep the current time; other days land at noon Bangkok time. */
function entryDate(day: string, keep?: Date) {
  if (keep && bangkokDay(keep) === day) return keep;
  return day === bangkokDay(new Date()) ? new Date() : new Date(`${day}T12:00:00+07:00`);
}

const firstIssue = (e: z.ZodError) => {
  const issue = e.issues[0];
  const line = issue.path[0] === "items" && typeof issue.path[1] === "number" ? `แถวที่ ${issue.path[1] + 1}: ` : "";
  return line + issue.message;
};

/* ---------------- sales ---------------- */

const saleItemSchema = z.object({
  // picked purchase line; null = found automatically (auto) or sold without a lot
  sourceItemId: z.number().int().nullable(),
  auto: z.boolean().default(false),
  // sold from this lot; with no line picked it is deducted from the lot, first lines first
  lotId: z.number().int().nullable().default(null),
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณากรอกรายการที่ขาย").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวน" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  unitPrice: z.number({ message: "กรุณากรอกราคา" }).finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999),
});

const saleSchema = z.object({
  id: z.number().int().optional(),
  party: partySchema,
  saleDate: z.string().date("วันที่ไม่ถูกต้อง"),
  paymentMethod: z.enum(["cash", "transfer"]),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
  slipImageIds: slipIdsSchema,
  // photos of the buyer's own bill / receipt
  billImageIds: slipIdsSchema,
  // lots sold out with this sale: close them
  closeLotIds: z.array(z.number().int()).max(BILL_MAX_ROWS).default([]),
  items: z.array(saleItemSchema).min(1, "กรุณาเพิ่มอย่างน้อย 1 รายการ").max(BILL_MAX_ROWS, `ใส่ได้ไม่เกิน ${BILL_MAX_ROWS} รายการ`),
});

export type SaleInput = z.input<typeof saleSchema>;

/** Record a sale. Each line is deducted (in money) from the purchase line it came out of. */
export async function saveSale(input: SaleInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, items, saleDate, party, slipImageIds, billImageIds, closeLotIds, ...head } = parsed.data;
  const lines = items.map(({ auto, ...it }, i) => {
    const qty = round(it.qty, 3);
    const unitPrice = round(it.unitPrice, 2);
    return { ...it, autoLot: !it.sourceItemId && !it.lotId && auto, unitName: it.unitName || null, qty, unitPrice, amount: round(qty * unitPrice, 2), lineNo: i + 1 };
  });
  const sourceIds = [...new Set(lines.flatMap((l) => (l.sourceItemId ? [l.sourceItemId] : [])))];
  const found = sourceIds.length
    ? await db.select({ id: schema.billItems.id }).from(schema.billItems).where(inArray(schema.billItems.id, sourceIds))
    : [];
  if (found.length !== sourceIds.length) return { ok: false, error: "ไม่พบรายการซื้อที่เลือก อาจถูกแก้ไขหรือลบไปแล้ว" };

  const total = round(lines.reduce((s, l) => s + l.amount, 0), 2);
  const savedId = await db.transaction(async (tx) => {
    // read before this sale's old lines go: an edited sale may keep using lots closed since
    const sources = toAllocSources(await getSourceOptions(id ?? 0, tx), await getStockSources(id ?? 0, tx));
    const customerId = await upsertCustomer(tx, party);
    const values = { ...head, buyerName: party.name, customerId, total };
    let saleId = id;
    if (saleId) {
      const [cur] = await tx.select({ saleDate: schema.sales.saleDate }).from(schema.sales).where(eq(schema.sales.id, saleId));
      if (!cur) throw new Error("sale not found");
      await tx
        .update(schema.sales)
        .set({ ...values, saleDate: entryDate(saleDate, cur.saleDate), updatedAt: new Date() })
        .where(eq(schema.sales.id, saleId));
      await tx.delete(schema.saleItems).where(eq(schema.saleItems.saleId, saleId));
    } else {
      const [row] = await tx
        .insert(schema.sales)
        .values({ ...values, saleDate: entryDate(saleDate), createdBy: user.id })
        .returning({ id: schema.sales.id });
      saleId = row.id;
    }
    const inserted = await tx
      .insert(schema.saleItems)
      .values(lines.map((l) => ({ ...l, saleId: saleId! })))
      .returning({ id: schema.saleItems.id });
    // deduct each line from its lots; automatic lines are split over the same item, oldest lot first
    const plan = allocate(
      lines.map((l) => ({ ...l, auto: l.autoLot })),
      sources,
    );
    const allocs = plan.flatMap((parts, i) =>
      parts.map((p) => ({
        saleItemId: inserted[i].id,
        // negative ids are stock added by hand
        ...(p.sourceId < 0 ? { stockInId: -p.sourceId } : { billItemId: p.sourceId }),
        qty: p.qty,
        amount: p.amount,
      })),
    );
    if (allocs.length) await tx.insert(schema.saleAllocations).values(allocs);
    if (closeLotIds.length) {
      await tx
        .update(schema.bills)
        .set({ lotClosedAt: new Date() })
        .where(and(inArray(schema.bills.id, closeLotIds), isNull(schema.bills.lotClosedAt)));
    }
    await syncAttachments(tx, { saleId }, slipImageIds, "slip");
    await syncAttachments(tx, { saleId }, billImageIds, "bill");
    return saleId;
  });
  revalidateTrade();
  return { ok: true, data: { id: savedId } };
}

export async function deleteSale(id: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(schema.sales).where(eq(schema.sales.id, id));
  revalidateTrade();
  return { ok: true };
}

/* ---------------- lots ---------------- */

/** Close a lot once it is sold out (hidden from the sale form), or reopen it. */
export async function setLotClosed(id: number, closed: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(schema.bills).set({ lotClosedAt: closed ? new Date() : null }).where(eq(schema.bills.id, id));
  revalidateTrade();
  revalidatePath(`/lots/${id}`);
  return { ok: true };
}

export async function saveLotNote(id: number, note: string): Promise<ActionResult> {
  await requireUser();
  await db.update(schema.bills).set({ lotNote: note.trim().slice(0, 500) || null }).where(eq(schema.bills.id, id));
  revalidatePath(`/lots/${id}`);
  revalidatePath("/lots");
  return { ok: true };
}

/* ---------------- customers ---------------- */

const customerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
  phone: z.string().trim().max(40).transform((v) => v || null),
  bankName: z.string().trim().max(60).transform((v) => v || null),
  bankAccount: z.string().trim().max(40).transform((v) => v || null),
});

export async function saveCustomer(id: number, input: z.input<typeof customerSchema>): Promise<ActionResult> {
  await requireUser();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const dup = await db.query.customers.findFirst({ where: eq(schema.customers.name, parsed.data.name) });
  if (dup && dup.id !== id) return { ok: false, error: "มีลูกค้าชื่อนี้อยู่แล้ว" };
  await db.transaction(async (tx) => {
    await tx.update(schema.customers).set(parsed.data).where(eq(schema.customers.id, id));
    // a rename is usually a typo fix: keep the names on their bills and sales in step
    await tx.update(schema.bills).set({ customerName: parsed.data.name }).where(eq(schema.bills.customerId, id));
    await tx.update(schema.sales).set({ buyerName: parsed.data.name }).where(eq(schema.sales.customerId, id));
  });
  revalidatePath("/customers");
  return { ok: true };
}

/** Remove a customer from the list; their bills and sales keep the name as printed. */
export async function deleteCustomer(id: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(schema.customers).where(eq(schema.customers.id, id));
  revalidatePath("/customers");
  return { ok: true };
}

/* ---------------- stock added by hand ---------------- */

const stockInSchema = z.object({
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณาเลือกสินค้า").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวนที่ได้เพิ่ม" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  note: z.string().trim().max(300).optional().transform((v) => v || null),
});

/** รับเข้าสต็อก: e.g. copper taken out of a TV. Sold and counted with the same item bought in lots. */
export async function addStockIn(input: z.input<typeof stockInSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = stockInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { unitName, qty, ...rest } = parsed.data;
  await db.insert(schema.stockIns).values({ ...rest, unitName: unitName || null, qty: round(qty, 3), createdBy: user.id });
  revalidatePath("/stock");
  revalidatePath("/sales");
  return { ok: true };
}

export async function deleteStockIn(id: number): Promise<ActionResult> {
  await requireUser();
  try {
    await db.delete(schema.stockIns).where(eq(schema.stockIns.id, id));
  } catch {
    return { ok: false, error: "ลบไม่ได้: มีการขายที่หักจากสต็อกนี้แล้ว" };
  }
  revalidatePath("/stock");
  return { ok: true };
}
