import { NextResponse, type NextRequest } from "next/server";

/**
 * The proxy every client-side fetch("/api/...") in this app quietly depends
 * on — identical to Cards' copy. See that project's version of this file for
 * the full rationale; the short version: it keeps the session cookie
 * first-party on THIS app's origin, and because both this app's proxy and
 * the API's Hono app mount at /api, every existing client-side fetch path
 * survives the split unchanged.
 *
 * RULES:
 *   1. Never log the request or response body — the admin restaurant-
 *      creation response carries a one-time plaintext password.
 *   2. Relay every Set-Cookie header, not just the first.
 *   3. Node runtime only (not edge), for getSetCookie() and duplex body
 *      streaming.
 *   4. The Razorpay webhook must hit the API directly, never through this
 *      proxy — see priinteve-api's routes/order/webhook.routes.ts.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");

async function proxy(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const target = `${API_INTERNAL_URL}${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  // The API's rate limiter keys on this for the public order endpoints.
  headers.set("x-real-ip", req.headers.get("x-forwarded-for") ?? req.ip ?? "");

  const hasBody = !["GET", "HEAD"].includes(req.method);

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // @ts-expect-error -- duplex is required by undici for a streamed body but missing from the RequestInit type.
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  response.headers.delete("set-cookie");
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
