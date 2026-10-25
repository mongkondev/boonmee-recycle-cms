"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { generateSecret } from "otplib";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { setSession } from "@/lib/auth";
import { findOpenInvite } from "@/lib/invites";
import { passwordProblems } from "@/lib/password-policy";

export async function acceptInvite(token: string, password: string, confirm: string): Promise<{ error: string } | undefined> {
  const invite = await findOpenInvite(token);
  if (!invite) return { error: "ลิงก์คำเชิญหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ" };
  const problems = passwordProblems(password);
  if (problems.length) return { error: `รหัสผ่านยังไม่ผ่านเงื่อนไข: ${problems.join(", ")}` };
  if (password !== confirm) return { error: "ยืนยันรหัสผ่านไม่ตรงกัน" };
  if (await db.query.users.findFirst({ where: eq(schema.users.email, invite.email) })) return { error: "อีเมลนี้มีบัญชีอยู่แล้ว" };

  const uid = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        email: invite.email,
        displayName: invite.displayName,
        role: invite.role,
        passwordHash: await bcrypt.hash(password, 12),
        totpSecret: generateSecret(),
      })
      .returning({ id: schema.users.id });
    await tx.update(schema.invitations).set({ acceptedAt: new Date() }).where(eq(schema.invitations.id, invite.id));
    return user.id;
  });
  // next: scan the Google Authenticator QR on /login/setup
  await setSession({ uid, stage: "setup" });
  redirect("/login/setup?step=2");
}
