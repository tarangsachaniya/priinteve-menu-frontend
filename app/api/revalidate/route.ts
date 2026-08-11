import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * On-demand ISR hook, called by the API's src/services/revalidate.ts via
 * revalidateMenuPaths(). All of this app's guest-facing pages are already
 * force-dynamic, so this exists mainly for symmetry with Cards and for any
 * future cached Menu page.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paths = Array.isArray(body?.paths) ? body.paths.filter((p: unknown) => typeof p === "string") : [];

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: paths });
}
