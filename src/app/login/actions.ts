"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { clearSession, getSession, setSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/password-policy";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type FormState = { error?: string } | undefined;

type User = typeof schema.users.$inferSelect;

function lockedMessage(u: User) {
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
    return `บัญชีถูกล็อกชั่วคราว ลองใหม่ใน ${mins} นาที`;
  }
}

async function registerFailure(u: User) {
  const attempts = u.failedAttempts + 1;
  await db
    .update(schema.users)
    .set(
      attempts >= MAX_ATTEMPTS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
        : { failedAttempts: attempts },
    )
    .where(eq(schema.users.id, u.id));
}

async function resetFailures(u: User) {
  await db
    .update(schema.users)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(schema.users.id, u.id));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !user.isActive) {
    await bcrypt.hash(password, 12); // keep timing similar for unknown users
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  const locked = lockedMessage(user);
  if (locked) return { error: locked };

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await registerFailure(user);
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  if (user.totpEnabled) {
    await setSession({ uid: user.id, stage: "verify" });
    redirect("/login/verify");
  }
  // first login: enrol an authenticator app
  if (!user.totpSecret) {
    await db
      .update(schema.users)
      .set({ totpSecret: generateSecret() })
      .where(eq(schema.users.id, user.id));
  }
  await setSession({ uid: user.id, stage: "setup" });
  redirect("/login/setup");
}

async function pendingUser(stage: "verify" | "setup") {
  const s = await getSession();
  if (!s || s.stage !== stage) redirect("/login");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, s.uid) });
  if (!user?.totpSecret || !user.isActive) redirect("/login");
  return user;
}

export async function getSetupQr() {
  const user = await pendingUser("setup");
  const uri = generateURI({ issuer: "Boonmee Recycle CMS", label: user.email ?? user.username ?? "admin", secret: user.totpSecret! });
  return { secret: user.totpSecret!, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

async function checkCode(user: User, form: FormData) {
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  const res = await verify({ secret: user.totpSecret!, token, epochTolerance: 30 });
  return res.valid;
}

export async function verifyAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await pendingUser("verify");
  const locked = lockedMessage(user);
  if (locked) return { error: locked };
  if (!(await checkCode(user, form))) {
    await registerFailure(user);
    return { error: "รหัส 2FA ไม่ถูกต้อง" };
  }
  await resetFailures(user);
  await setSession({ uid: user.id, stage: "full" });
  redirect("/");
}

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await pendingUser("setup");
  if (!(await checkCode(user, form))) return { error: "รหัสไม่ถูกต้อง ลองสแกน QR ใหม่แล้วกรอกรหัสล่าสุด" };
  await db
    .update(schema.users)
    .set({ totpEnabled: true, failedAttempts: 0, lockedUntil: null })
    .where(eq(schema.users.id, user.id));
  await setSession({ uid: user.id, stage: "full" });
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
