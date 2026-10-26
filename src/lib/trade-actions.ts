"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import type { ActionResult } from "./actions";
import { requireUser } from "./auth";
import { BILL_MAX_ROWS, bangkokDay } from "./bill";
import { partySchema, upsertCustomer } from "./customers";

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
  sourceItemId: z.number({ message: "กรุณาเลือกว่าขายจากรายการซื้อ / LOT ไหน" }).int(),
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
  items: z.array(saleItemSchema).min(1, "กรุณาเพิ่มอย่างน้อย 1 รายการ").max(BILL_MAX_ROWS, `ใส่ได้ไม่เกิน ${BILL_MAX_ROWS} รายการ`),
});

export type SaleInput = z.input<typeof saleSchema>;

/** Record a sale. Each line is deducted (in money) from the purchase line it came out of. */
export async function saveSale(input: SaleInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, items, saleDate, party, ...head } = parsed.data;
  const lines = items.map((it, i) => {
    const qty = round(it.qty, 3);
    const unitPrice = round(it.unitPrice, 2);
    return { ...it, unitName: it.unitName || null, qty, unitPrice, amount: round(qty * unitPrice, 2), lineNo: i + 1 };
  });
  const sourceIds = [...new Set(lines.map((l) => l.sourceItemId))];
  const found = await db.select({ id: schema.billItems.id }).from(schema.billItems).where(inArray(schema.billItems.id, sourceIds));
  if (found.length !== sourceIds.length) return { ok: false, error: "ไม่พบรายการซื้อที่เลือก อาจถูกแก้ไขหรือลบไปแล้ว" };

  const total = round(lines.reduce((s, l) => s + l.amount, 0), 2);
  const savedId = await db.transaction(async (tx) => {
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
    await tx.insert(schema.saleItems).values(lines.map((l) => ({ ...l, saleId: saleId! })));
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
