"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import type { ActionResult } from "./actions";
import { requireUser } from "./auth";
import { BILL_MAX_ROWS, bangkokDay } from "./bill";
import { stockKey } from "./stock-key";
import { getStock } from "./trade-queries";

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 3 });

function revalidateTrade() {
  for (const p of ["/", "/sales", "/stock", "/reports"]) revalidatePath(p);
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
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณาเลือกรายการ").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวน" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  unitPrice: z.number({ message: "กรุณากรอกราคา" }).finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999),
});

const saleSchema = z.object({
  id: z.number().int().optional(),
  buyerName: z.string().trim().max(120).optional().transform((v) => v || null),
  saleDate: z.string().date("วันที่ไม่ถูกต้อง"),
  paymentMethod: z.enum(["cash", "transfer"]),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
  items: z.array(saleItemSchema).min(1, "กรุณาเพิ่มอย่างน้อย 1 รายการ").max(BILL_MAX_ROWS, `ใส่ได้ไม่เกิน ${BILL_MAX_ROWS} รายการ`),
});

export type SaleInput = z.input<typeof saleSchema>;

/** Record a sale. Every line must come out of stock and may not exceed what is left. */
export async function saveSale(input: SaleInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, items, saleDate, ...head } = parsed.data;
  const lines = items.map((it, i) => {
    const qty = round(it.qty, 3);
    const unitPrice = round(it.unitPrice, 2);
    return { ...it, unitName: it.unitName || null, qty, unitPrice, amount: round(qty * unitPrice, 2), lineNo: i + 1 };
  });

  const stock = new Map((await getStock({ excludeSaleId: id })).map((s) => [s.key, s]));
  const wanted = new Map<string, number>();
  for (const l of lines) {
    const k = stockKey(l.productId, l.title, l.unitName);
    wanted.set(k, (wanted.get(k) ?? 0) + l.qty);
  }
  for (const [k, qty] of wanted) {
    const s = stock.get(k);
    if (!s) return { ok: false, error: `"${lines.find((l) => stockKey(l.productId, l.title, l.unitName) === k)!.title}" ไม่มีในสต็อก` };
    if (qty > s.remaining + 1e-9) {
      return { ok: false, error: `"${s.title}" เหลือขายได้ ${fmt(s.remaining)} ${s.unitName ?? ""} แต่ใส่ไว้ ${fmt(qty)}` };
    }
  }

  const total = round(lines.reduce((s, l) => s + l.amount, 0), 2);
  const savedId = await db.transaction(async (tx) => {
    let saleId = id;
    if (saleId) {
      const [cur] = await tx.select({ saleDate: schema.sales.saleDate }).from(schema.sales).where(eq(schema.sales.id, saleId));
      if (!cur) throw new Error("sale not found");
      await tx
        .update(schema.sales)
        .set({ ...head, saleDate: entryDate(saleDate, cur.saleDate), total, updatedAt: new Date() })
        .where(eq(schema.sales.id, saleId));
      await tx.delete(schema.saleItems).where(eq(schema.saleItems.saleId, saleId));
    } else {
      const [row] = await tx
        .insert(schema.sales)
        .values({ ...head, saleDate: entryDate(saleDate), total, createdBy: user.id })
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

/* ---------------- dismantling (แยกชิ้นส่วน) ---------------- */

const partSchema = z.object({
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณากรอกชื่อชิ้นส่วน").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวน" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  cost: z.number({ message: "กรุณากรอกต้นทุน" }).finite().min(0, "ต้นทุนต้องไม่ติดลบ").max(9_999_999_999),
});

const dismantleSchema = z.object({
  sourceKey: z.string().min(1, "กรุณาเลือกรายการที่จะแยก"),
  qty: z.number({ message: "กรุณากรอกจำนวนที่แยก" }).finite().positive("จำนวนต้องมากกว่า 0"),
  adjDate: z.string().date("วันที่ไม่ถูกต้อง"),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
  items: z.array(partSchema).min(1, "กรุณาเพิ่มชิ้นส่วนอย่างน้อย 1 รายการ").max(BILL_MAX_ROWS),
});

export type DismantleInput = z.input<typeof dismantleSchema>;

/** Take `qty` of one stock item out and put its parts in; the parts carry the cost that left. */
export async function saveDismantle(input: DismantleInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = dismantleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  const src = (await getStock()).find((s) => s.key === d.sourceKey);
  if (!src) return { ok: false, error: "ไม่พบรายการในสต็อก" };
  const qty = round(d.qty, 3);
  if (qty > src.remaining + 1e-9) return { ok: false, error: `"${src.title}" เหลือ ${fmt(src.remaining)} ${src.unitName ?? ""} เท่านั้น` };

  await db.transaction(async (tx) => {
    const [adj] = await tx
      .insert(schema.stockAdjustments)
      .values({ adjDate: entryDate(d.adjDate), note: d.note, createdBy: user.id })
      .returning({ id: schema.stockAdjustments.id });
    await tx.insert(schema.stockAdjustmentItems).values([
      {
        adjustmentId: adj.id,
        productId: src.productId,
        title: src.title,
        unitName: src.unitName,
        qty: -qty,
        cost: -round(qty * src.avgCost, 2),
      },
      ...d.items.map((p) => ({
        adjustmentId: adj.id,
        productId: p.productId,
        title: p.title,
        unitName: p.unitName || null,
        qty: round(p.qty, 3),
        cost: round(p.cost, 2),
      })),
    ]);
  });
  revalidateTrade();
  return { ok: true };
}

export async function deleteAdjustment(id: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(schema.stockAdjustments).where(eq(schema.stockAdjustments.id, id));
  revalidateTrade();
  return { ok: true };
}
