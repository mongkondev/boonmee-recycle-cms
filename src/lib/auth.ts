import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { readSession, SESSION_COOKIE, SESSION_TTL, signSession, type Session } from "./session";

export async function setSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL[s.stage],
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Current fully-authenticated user, or redirect to login. Use in pages & server actions. */
export async function requireUser() {
  const s = await getSession();
  if (!s || s.stage !== "full") redirect("/login");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, s.uid) });
  if (!user || !user.totpEnabled) redirect("/login");
  return user;
}
