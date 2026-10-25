import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

const STAGE_PAGES: Record<string, string> = { verify: "/login/verify", setup: "/login/setup" };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/login")) {
    if (session?.stage === "full") return NextResponse.redirect(new URL("/", req.url));
    // stage pages need the matching half-login cookie
    const needed = Object.entries(STAGE_PAGES).find(([, p]) => pathname === p)?.[0];
    if (needed && session?.stage !== needed) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  if (session?.stage !== "full") {
    if (pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
