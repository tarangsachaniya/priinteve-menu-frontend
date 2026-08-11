/**
 * Two ways to reach the API, used in different places:
 *
 *   - API_INTERNAL_URL — server components call the API DIRECTLY at this
 *     address, never through this app's own proxy. Routing a server
 *     component through app/api/[...path]/route.ts would mean this Next
 *     server calling itself over HTTP for every render.
 *   - API_PUBLIC_PATH — client components fetch this SAME-ORIGIN path. The
 *     catch-all proxy at app/api/[...path]/route.ts forwards it to the API,
 *     which is what keeps the session cookie first-party on this app's
 *     origin instead of the API's.
 *
 * Default is 127.0.0.1, not "localhost": on Windows, "localhost" can resolve
 * to the IPv6 ::1 first, which Bun.serve does not bind by default — every
 * server-side fetch (including build-time reads) then fails with
 * ECONNREFUSED even though the API is genuinely up.
 */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
export const API_PUBLIC_PATH = "/api";
