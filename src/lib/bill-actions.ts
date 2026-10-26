"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "./auth";
import { BILL_MAX_ROWS } from "./bill";
import type { ActionResult } from "./actions";

const bangkokDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

const itemSchema = z.object({
  productId: z.number().int().nullable(),
  title: z.string().trim().min(1, "กรุณากรอกชื่อรายการ").max(200),
  unitName: z.string().trim().max(40).nullable(),
  qty: z.number({ message: "กรุณากรอกจำนวน" }).finite().positive("จำนวนต้องมากกว่า 0").max(99_999_999),
  unitPrice: z.number({ message: "กรุณากรอกราคา" }).finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999),
});

const billSchema = z.object({
  id: z.number().int().optional(),
  customerName: z.string().trim().max(120).optional().transform((v) => v || null),
  billDate: z.string().date("วันที่ไม่ถูกต้อง"),
  paymentMethod: z.enum(["cash", "transfer"]),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
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
  const { id, items, billDate, ...head } = parsed.data;
  const lines = items.map((it, i) => {
    const qty = round(it.qty, 3);
    const unitPrice = round(it.unitPrice, 2);
    return { ...it, qty, unitPrice, amount: round(qty * unitPrice, 2), lineNo: i + 1 };
  });
  const total = round(lines.reduce((s, l) => s + l.amount, 0), 2);
  // keep the time of day for today's bills so the list sorts naturally; other dates land at noon (Bangkok)
  const today = bangkokDay(new Date());
  let date = billDate === today ? new Date() : new Date(`${billDate}T12:00:00+07:00`);

  const savedId = await db.transaction(async (tx) => {
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
      await tx.delete(schema.billItems).where(eq(schema.billItems.billId, billId));
    } else {
      const [row] = await tx
        .insert(schema.bills)
        .values({ ...head, billDate: date, total, createdBy: user.id })
        .returning({ id: schema.bills.id });
      billId = row.id;
    }
    await tx.insert(schema.billItems).values(lines.map((l) => ({ ...l, billId: billId! })));
    return billId;
  });
  revalidatePath("/bills");
  return { ok: true, data: { id: savedId } };
}

export async function deleteBill(id: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(schema.bills).where(eq(schema.bills.id, id));
  revalidatePath("/bills");
  return { ok: true };
}
