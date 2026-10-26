"use server";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "./auth";
import { BILL_MAX_ROWS, bangkokDay } from "./bill";
import type { ActionResult } from "./actions";
import { partySchema, upsertCustomer } from "./customers";

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

const itemSchema = z.object({
  // existing purchase line (kept so sales deducted from it stay linked)
  id: z.number().int().optional(),
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณากรอกชื่อรายการ").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวน" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  unitPrice: z.number({ message: "กรุณากรอกราคา" }).finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999),
});

const billSchema = z.object({
  id: z.number().int().optional(),
  party: partySchema,
  billDate: z.string().date("วันที่ไม่ถูกต้อง"),
  paymentMethod: z.enum(["cash", "transfer"]),
  // false = record the purchase only; the bill can be issued later
  issueBill: z.boolean(),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
  lotNote: z.string().trim().max(500).optional().transform((v) => v || null),
  items: z.array(itemSchema).min(1, "กรุณาเพิ่มอย่างน้อย 1 รายการ").max(BILL_MAX_ROWS, `บิลหนึ่งใบใส่ได้ไม่เกิน ${BILL_MAX_ROWS} รายการ`),
});

export type BillInput = z.input<typeof billSchema>;

/** Create or replace a bill. Amounts and the total are always recomputed on the server. */
export async function saveBill(input: BillInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const line = issue.path[0] === "items" && typeof issue.path[1] === "number" ? `แถวที่ ${issue.path[1] + 1}: ` : "";
    return { ok: false, error: line + issue.message };
  }
  const { id, items, billDate, issueBill, party, ...rest } = parsed.data;
  const lines = items.map((it, i) => {
    const qty = round(it.qty, 3);
    const unitPrice = round(it.unitPrice, 2);
    return { ...it, qty, unitPrice, amount: round(qty * unitPrice, 2), lineNo: i + 1 };
  });
  const total = round(lines.reduce((s, l) => s + l.amount, 0), 2);
  // keep the time of day for today's bills so the list sorts naturally; other dates land at noon (Bangkok)
  const today = bangkokDay(new Date());
  let date = billDate === today ? new Date() : new Date(`${billDate}T12:00:00+07:00`);

  try {
    const savedId = await db.transaction(async (tx) => {
      const customerId = await upsertCustomer(tx, party);
      const head = { ...rest, customerName: party.name, customerId };
      let billId = id;
      if (billId) {
        const [cur] = await tx.select({ billDate: schema.bills.billDate }).from(schema.bills).where(eq(schema.bills.id, billId));
        // editing without changing the day keeps the original time
        if (cur && bangkokDay(cur.billDate) === billDate) date = cur.billDate;
        const [row] = await tx
          .update(schema.bills)
          .set({ ...head, billDate: date, total, updatedAt: new Date() })
          .where(eq(schema.bills.id, billId))
          .returning({ id: schema.bills.id });
        if (!row) throw new Error("bill not found");
        const keep = lines.flatMap((l) => (l.id ? [l.id] : []));
        await tx
          .delete(schema.billItems)
          .where(and(eq(schema.billItems.billId, billId), keep.length ? notInArray(schema.billItems.id, keep) : undefined));
      } else {
        const lotNo = await nextLotNo(tx, billDate);
        const [row] = await tx
          .insert(schema.bills)
          .values({ ...head, lotNo, billDate: date, total, createdBy: user.id })
          .returning({ id: schema.bills.id });
        billId = row.id;
      }
      const own = billId
        ? new Set(
            (await tx.select({ id: schema.billItems.id }).from(schema.billItems).where(eq(schema.billItems.billId, billId))).map((r) => r.id),
          )
        : new Set<number>();
      for (const { id: itemId, ...l } of lines) {
        if (itemId && own.has(itemId)) {
          await tx.update(schema.billItems).set(l).where(eq(schema.billItems.id, itemId));
        } else {
          await tx.insert(schema.billItems).values({ ...l, billId: billId! });
        }
      }
      if (issueBill) await assignBillNo(tx, billId);
      return billId;
    });
    revalidateBills();
    return { ok: true, data: { id: savedId } };
  } catch (e) {
    if (isFkViolation(e)) return { ok: false, error: "ลบแถวไม่ได้: มีการขายที่หักจากรายการซื้อนั้นแล้ว กรุณาแก้ไขรายการขายก่อน" };
    throw e;
  }
}

function isFkViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

function revalidateBills() {
  for (const p of ["/bills", "/dashboard", "/lots", "/reports", "/sales"]) revalidatePath(p);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** LOT-BM + yyyymmdd + 4-digit running number within that day, e.g. LOT-BM202610260001. */
async function nextLotNo(tx: Tx, day: string) {
  const prefix = `LOT-BM${day.replaceAll("-", "")}`;
  await tx.execute(sql`lock table bills in share row exclusive mode`);
  const [row] = await tx.execute<{ n: number }>(sql`
    select coalesce(max(substr(lot_no, ${prefix.length + 1})::int), 0) + 1 as n from bills where lot_no like ${prefix + "%"}
  `);
  return prefix + String(row.n).padStart(4, "0");
}

/** Give the purchase the next bill number (no-op when it already has one). */
async function assignBillNo(tx: Tx, id: number) {
  await tx.execute(sql`lock table bills in share row exclusive mode`);
  await tx.execute(sql`
    update bills set bill_no = (select coalesce(max(bill_no), 0) + 1 from bills) where id = ${id} and bill_no is null
  `);
}

/** Issue the bill for a purchase that was recorded without one. */
export async function issueBill(id: number): Promise<ActionResult> {
  await requireUser();
  await db.transaction((tx) => assignBillNo(tx, id));
  revalidateBills();
  return { ok: true };
}

export async function deleteBill(id: number): Promise<ActionResult> {
  await requireUser();
  try {
    await db.delete(schema.bills).where(eq(schema.bills.id, id));
  } catch (e) {
    if (isFkViolation(e)) return { ok: false, error: "ลบไม่ได้: มีการขายที่หักจาก LOT นี้แล้ว กรุณาลบรายการขายเหล่านั้นก่อน" };
    throw e;
  }
  revalidateBills();
  return { ok: true };
}
