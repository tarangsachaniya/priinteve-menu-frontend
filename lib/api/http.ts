/**
 * The one request function every server-side API call goes through.
 * Mirrors the API's own response envelope: success bodies are returned
 * as-is, failures throw ApiError with the status and parsed body attached.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
  /** Raw Cookie header value to forward — set by server.ts, never by callers. */
  cookie?: string;
  /** When true, a 404 response returns null instead of throwing. */
  allow404?: boolean;
};

export async function apiRequest<T>(baseUrl: string, path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers["cookie"] = opts.cookie;

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache,
    next: opts.next,
  });

  if (res.status === 404 && opts.allow404) {
    return null as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }

  return parsed as T;
}
