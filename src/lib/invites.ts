import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** A still-valid (unused, unexpired) invitation for a raw token, or null. */
export async function findOpenInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return (
    (await db.query.invitations.findFirst({
      where: and(
        eq(schema.invitations.tokenHash, hashToken(token)),
        isNull(schema.invitations.acceptedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    })) ?? null
  );
}
