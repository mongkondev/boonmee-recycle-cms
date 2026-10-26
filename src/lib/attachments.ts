import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { schema, type db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const slipIdsSchema = z.array(z.string().uuid()).max(20).optional();

export type AttachmentKind = "slip" | "bill";

/** Make the purchase's / sale's attachments of one kind exactly `imageIds` (images uploaded from the form). */
export async function syncAttachments(
  tx: Tx,
  target: { billId: number } | { saleId: number },
  imageIds: string[] | undefined,
  kind: AttachmentKind = "slip",
) {
  if (!imageIds) return;
  const col = "billId" in target ? schema.attachments.billId : schema.attachments.saleId;
  const id = "billId" in target ? target.billId : target.saleId;
  const own = and(eq(col, id), eq(schema.attachments.kind, kind));
  const gone = await tx
    .select({ imageId: schema.attachments.imageId })
    .from(schema.attachments)
    .where(and(own, imageIds.length ? notInArray(schema.attachments.imageId, imageIds) : undefined));
  // removing the image removes its attachment row too (cascade)
  if (gone.length) await tx.delete(schema.images).where(inArray(schema.images.id, gone.map((g) => g.imageId)));
  const have = new Set(
    (await tx.select({ imageId: schema.attachments.imageId }).from(schema.attachments).where(own)).map((r) => r.imageId),
  );
  const add = imageIds.filter((i) => !have.has(i));
  if (add.length) await tx.insert(schema.attachments).values(add.map((imageId) => ({ ...target, imageId, kind })));
}
