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
/**
 * AUTH_JWT_SECRET must be set here as well as on the API — this file verifies
 * the same tokens the API signs, so a missing or mismatched value makes every
 * valid cookie look forged.
 *
 * That failure used to be invisible and catastrophic: the secret defaulted to
 * "", jwtVerify threw for a perfectly good session, and every /r/* navigation
 * bounced to /r/login. It presented exactly as "the restaurant keeps getting
 * logged out", which is a very long way from "an environment variable is
 * missing on the Menu deployment".
 *
 * So an absent secret now DISABLES this check rather than failing it closed.
 * Nothing is unguarded by that: this file is advisory anti-flash routing, and
 * the layouts below still call the API fresh on every request. Losing the
 * secret costs a flash of a loading state, not a locked-out kitchen — and the
 * console.error names the actual problem.
 */
const secret = process.env.AUTH_JWT_SECRET ?? "";
const key = new TextEncoder().encode(secret);

if (!secret) {
  console.error(
    "[middleware] AUTH_JWT_SECRET is not set — advisory /r and /admin routing is disabled. " +
      "Set it to the same value the API uses.",
  );
}

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

  // Without a secret every verify() below would answer false and redirect
  // everyone. Hand the decision to the layouts instead.
  if (!secret) return NextResponse.next();

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
