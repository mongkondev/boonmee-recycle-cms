"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import type { ActionResult } from "./actions";
import { requireUser } from "./auth";

export type AttachTarget = { billId: number } | { saleId: number };

const pathOf = (t: AttachTarget) => ("billId" in t ? `/bills/${t.billId}` : `/sales/${t.saleId}`);

/** Attach a slip photo (already shrunk to JPEG in the browser) to a purchase or a sale. */
export async function addAttachment(target: AttachTarget, form: FormData): Promise<ActionResult> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false, error: "รองรับเฉพาะรูปภาพ" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "รูปใหญ่เกิน 4MB" };
  await db.transaction(async (tx) => {
    const [img] = await tx
      .insert(schema.images)
      .values({ mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
      .returning({ id: schema.images.id });
    await tx.insert(schema.attachments).values({ ...target, imageId: img.id });
  });
  revalidatePath(pathOf(target));
  return { ok: true };
}

export async function deleteAttachment(id: number): Promise<ActionResult> {
  await requireUser();
  const [row] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  if (!row) return { ok: true };
  // the attachment row goes with its image (cascade)
  await db.delete(schema.images).where(eq(schema.images.id, row.imageId));
  revalidatePath(row.billId ? `/bills/${row.billId}` : `/sales/${row.saleId}`);
  return { ok: true };
}
