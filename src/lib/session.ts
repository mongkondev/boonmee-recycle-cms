import { jwtVerify, SignJWT } from "jose";

// Edge-safe: imported by middleware, so only depends on `jose`.
export const SESSION_COOKIE = "bm_session";

export type SessionStage = "full" | "verify" | "setup";
export type Session = { uid: number; stage: SessionStage };

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export const SESSION_TTL: Record<SessionStage, number> = {
  full: 60 * 60 * 24 * 7,
  verify: 60 * 5,
  setup: 60 * 10,
};

export async function signSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL[s.stage]}s`)
    .sign(key());
}

export async function readSession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { uid: Number(payload.uid), stage: payload.stage as SessionStage };
  } catch {
    return null;
  }
}
