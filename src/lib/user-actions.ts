"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import type { ActionResult } from "./actions";
import { requireSuper } from "./auth";
import { hashToken } from "./invites";
import { sendMail } from "./mail";
import { isEmail, normalizeEmail } from "./password-policy";

const INVITE_HOURS = 72;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function issueInvite(inviteId: number, email: string, displayName: string | null, inviterName: string) {
  const token = randomBytes(32).toString("base64url");
  await db
    .update(schema.invitations)
    .set({ tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000) })
    .where(eq(schema.invitations.id, inviteId));
  const link = `${await origin()}/invite/${token}`;
  let emailed = false;
  try {
    emailed = await sendMail(
      email,
      "คำเชิญเข้าใช้งานระบบ บุญมี รีไซเคิล CMS",
      `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">
        <p>สวัสดี${displayName ? ` คุณ${esc(displayName)}` : ""},</p>
        <p>${esc(inviterName)} เชิญคุณเป็นผู้ดูแลระบบราคารับซื้อของร้าน บุญมี รีไซเคิล</p>
        <p><a href="${link}" style="display:inline-block;background:#3a9e1d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">ตั้งรหัสผ่านและเปิดใช้งานบัญชี</a></p>
        <p style="color:#64748b;font-size:13px">ลิงก์นี้ใช้ได้ ${INVITE_HOURS} ชั่วโมง และใช้ได้ครั้งเดียว</p>
      </div>`,
    );
  } catch (e) {
    console.error("invite mail failed", e);
  }
  return { link, emailed };
}

export async function createInvite(input: { email: string; displayName: string }): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const me = await requireSuper();
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  if (await db.query.users.findFirst({ where: eq(schema.users.email, email) })) return { ok: false, error: "อีเมลนี้เป็นผู้ใช้อยู่แล้ว" };
  // one open invite per e-mail: reuse it with a fresh token
  const open = await db.query.invitations.findFirst({
    where: and(eq(schema.invitations.email, email), isNull(schema.invitations.acceptedAt)),
  });
  const displayName = input.displayName.trim().slice(0, 60) || null;
  const id =
    open?.id ??
    (
      await db
        .insert(schema.invitations)
        .values({ email, displayName, invitedBy: me.id, tokenHash: randomBytes(16).toString("hex"), expiresAt: new Date() })
        .returning({ id: schema.invitations.id })
    )[0].id;
  if (open) await db.update(schema.invitations).set({ displayName }).where(eq(schema.invitations.id, id));
  const res = await issueInvite(id, email, displayName, me.displayName || me.email || "ผู้ดูแลระบบ");
  revalidatePath("/users");
  return { ok: true, data: res };
}

export async function resendInvite(id: number): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const me = await requireSuper();
  const inv = await db.query.invitations.findFirst({ where: and(eq(schema.invitations.id, id), isNull(schema.invitations.acceptedAt)) });
  if (!inv) return { ok: false, error: "ไม่พบคำเชิญ" };
  const res = await issueInvite(inv.id, inv.email, inv.displayName, me.displayName || me.email || "ผู้ดูแลระบบ");
  revalidatePath("/users");
  return { ok: true, data: res };
}

export async function revokeInvite(id: number): Promise<ActionResult> {
  await requireSuper();
  await db.delete(schema.invitations).where(and(eq(schema.invitations.id, id), isNull(schema.invitations.acceptedAt)));
  revalidatePath("/users");
  return { ok: true };
}

async function targetUser(id: number) {
  const me = await requireSuper();
  if (id === me.id) return { error: "ไม่สามารถทำรายการนี้กับบัญชีของตัวเองได้" } as const;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user) return { error: "ไม่พบผู้ใช้" } as const;
  return { user } as const;
}

export async function setUserActive(id: number, isActive: boolean): Promise<ActionResult> {
  const t = await targetUser(id);
  if ("error" in t) return { ok: false, error: t.error! };
  await db.update(schema.users).set({ isActive }).where(eq(schema.users.id, id));
  revalidatePath("/users");
  return { ok: true };
}

/** Force the user to scan a new Google Authenticator QR at next login. */
export async function resetUserTotp(id: number): Promise<ActionResult> {
  const t = await targetUser(id);
  if ("error" in t) return { ok: false, error: t.error! };
  await db.update(schema.users).set({ totpEnabled: false, totpSecret: null }).where(eq(schema.users.id, id));
  revalidatePath("/users");
  return { ok: true };
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const t = await targetUser(id);
  if ("error" in t) return { ok: false, error: t.error! };
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/users");
  return { ok: true };
}
