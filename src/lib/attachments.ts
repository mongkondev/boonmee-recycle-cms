import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { schema, type db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const slipIdsSchema = z.array(z.string().uuid()).max(20).optional();

/** Make the purchase's / sale's slips exactly `imageIds` (images uploaded from the form). */
export async function syncAttachments(tx: Tx, target: { billId: number } | { saleId: number }, imageIds: string[] | undefined) {
  if (!imageIds) return;
  const col = "billId" in target ? schema.attachments.billId : schema.attachments.saleId;
  const id = "billId" in target ? target.billId : target.saleId;
  const gone = await tx
    .select({ imageId: schema.attachments.imageId })
    .from(schema.attachments)
    .where(and(eq(col, id), imageIds.length ? notInArray(schema.attachments.imageId, imageIds) : undefined));
  // removing the image removes its attachment row too (cascade)
  if (gone.length) await tx.delete(schema.images).where(inArray(schema.images.id, gone.map((g) => g.imageId)));
  const have = new Set(
    (await tx.select({ imageId: schema.attachments.imageId }).from(schema.attachments).where(eq(col, id))).map((r) => r.imageId),
  );
  const add = imageIds.filter((i) => !have.has(i));
  if (add.length) await tx.insert(schema.attachments).values(add.map((imageId) => ({ ...target, imageId })));
}
