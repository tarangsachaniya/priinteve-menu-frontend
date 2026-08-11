import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Advisory UX routing for two distinct realms sharing this app:
 *   - /r/*     — restaurant staff (pv_resto, aud "restaurant")
 *   - /admin/* — platform admin, same realm as Cards (pv_session, aud "user")
 *
 * This is not the authoritative gate for either — that's the layouts, which
 * call the API fresh on every request (GET /api/restaurant/session checks
 * isActive; the admin layout checks role === "ADMIN"). This file only avoids
 * a flash of protected content before those checks run.
 */
const key = new TextEncoder().encode(process.env.AUTH_JWT_SECRET ?? "");

async function verify(token: string | undefined, audience: "restaurant" | "user"): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, key, { audience });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/r") && pathname !== "/r/login") {
    const ok = await verify(request.cookies.get("pv_resto")?.value, "restaurant");
    if (!ok) return NextResponse.redirect(new URL("/r/login", request.url));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const raw = request.cookies.get("pv_session")?.value;
    let role: string | undefined;
    if (raw) {
      try {
        const { payload } = await jwtVerify(raw, key, { audience: "user" });
        role = typeof payload.role === "string" ? payload.role : undefined;
      } catch {
        role = undefined;
      }
    }
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/r/:path*", "/admin/:path*"],
};
