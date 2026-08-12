import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * On-demand cache invalidation, called by the API's src/services/revalidate.ts.
 *
 * Two mechanisms, because the app caches two different things:
 *
 *   - `tags` drops cached FETCH results. This is the one that matters for the
 *     menu: the guest pages render per request but read their data from a
 *     tagged, cached fetch, so dropping the tag is what makes an owner's edit
 *     visible on the next scan instead of up to five minutes later.
 *   - `paths` drops rendered routes, kept for symmetry with Cards and for any
 *     Menu page that becomes statically rendered later.
 *
 * Both are accepted in one body; the API sends whichever it has.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((v: unknown): v is string => typeof v === "string") : [];

  const paths = strings(body?.paths);
  const tags = strings(body?.tags);

  for (const path of paths) revalidatePath(path);
  for (const tag of tags) revalidateTag(tag);

  return NextResponse.json({ revalidated: { paths, tags } });
}
