import { API_PUBLIC_PATH } from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";

/**
 * For client-side code that fetches from a component instead of a server
 * page. Most existing components keep their raw fetch("/api/...") calls
 * unchanged — the proxy makes every one of those paths resolve exactly as it
 * did against the monolith.
 */
export async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PUBLIC_PATH}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
