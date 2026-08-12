/**
 * Browser-direct uploads to S3.
 *
 * The file used to be POSTed to /api/..., which this app's catch-all proxy
 * forwarded to the API. That proxy is a Vercel Serverless Function, and Vercel
 * caps a function's request body at 4.5 MB — a hard platform limit. A photo off
 * a modern phone clears that easily, and the failure was a bare 413 from the
 * edge, before any of our code ran, so the upload form could not even report it
 * properly.
 *
 * Now the API only *authorises* the upload and the bytes go straight to S3. Two
 * round trips instead of one, but no size ceiling and the file never transits
 * two servers to reach a third.
 *
 * The API still validates: the presigned POST it returns carries S3-enforced
 * conditions on both content type and size, so an oversized or wrong-typed file
 * is rejected by S3 itself with nothing written.
 */

export type DirectUploadResult = Record<string, unknown>;

/**
 * Longest edge kept when an image is downscaled before upload.
 *
 * Generous on purpose: well past what any screen in either app displays, so it
 * only ever discards pixels nobody was going to see. A 12 MP phone photo lands
 * around 250 KB of WebP instead of 5 MB of JPEG.
 */
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 0.85;

/**
 * Formats that must not be re-encoded.
 *
 * GIF because canvas flattens it to a single frame, silently turning an
 * animation into a still. SVG because it is already vector and rasterising it
 * throws that away. Everything non-image — PDFs on the card-field route — is
 * excluded by the `image/` check itself.
 */
const NEVER_REENCODE = ["image/gif", "image/svg+xml"];

/**
 * Shrinks an oversized photo in the browser, before it is uploaded.
 *
 * Cloudinary used to cap dimensions on ingest, so the stored file was already
 * sensible no matter what a phone produced. S3 stores exactly what it is given,
 * so without this every dish photo would be kept and served at full camera
 * resolution — and a 5 MB upload would fail the size limit outright, which is
 * what prompted this.
 *
 * Returns the original file untouched if it is already small enough, is a
 * format that must not be re-encoded, or if anything goes wrong: a failed
 * resize should degrade to uploading the original, never to no upload at all.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || NEVER_REENCODE.includes(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));

    // Already small enough, and re-encoding would only lose quality.
    if (scale === 1 && file.size <= 1_000_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

type PresignResponse = {
  uploadUrl: string;
  fields: Record<string, string>;
} & DirectUploadResult;

/**
 * Asks `endpoint` to authorise an upload, sends the file to S3, and returns
 * whatever else the endpoint replied with — the public URL and storage key,
 * under the same response keys the old single-step routes used, so callers
 * store exactly what they stored before.
 *
 * `onProgress` reports the real upload, which the old flow could not: progress
 * against our own server only ever measured the first of two hops.
 */
export async function uploadDirect(
  original: File,
  endpoint: string,
  options?: {
    extra?: Record<string, string>;
    onProgress?: (percent: number) => void;
    /** Set false for uploads that must keep their exact bytes. */
    downscale?: boolean;
  },
): Promise<DirectUploadResult> {
  // Before the presign call, not after: shrinking changes the content type to
  // WebP, and that type is baked into the signature S3 then enforces.
  const file = options?.downscale === false ? original : await downscaleImage(original);

  const presignRes = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, ...options?.extra }),
  });

  const presign = (await presignRes.json().catch(() => ({}))) as Partial<PresignResponse> & {
    error?: string;
  };

  if (!presignRes.ok || !presign.uploadUrl || !presign.fields) {
    throw new Error(typeof presign.error === "string" ? presign.error : "Upload failed");
  }

  const { uploadUrl, fields, ...rest } = presign as PresignResponse;

  // S3 requires the policy fields before the file — it stops reading at the
  // first `file` part, so anything appended after it is ignored.
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  body.append("file", file);

  await postToS3(uploadUrl, body, options?.onProgress);

  return rest;
}

/**
 * XHR rather than fetch purely for upload progress — fetch still cannot report
 * it. A presigned POST answers 204 with an empty body on success; anything else
 * is an S3 error document, and its status is the useful part.
 */
function postToS3(
  url: string,
  body: FormData,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(describeS3Error(xhr.responseText, xhr.status)));
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.send(body);
  });
}

/**
 * Turns an S3 error document into something worth showing a restaurant owner.
 *
 * A rejected upload answers with XML, and putting that on screen — as
 * "<Error><Code>EntityTooLarge</Code>…" — tells them nothing they can act on.
 * The two codes that actually happen here are the two signed conditions being
 * violated, and each has an obvious remedy.
 */
function describeS3Error(responseText: string, status: number): string {
  const code = /<Code>([^<]+)<\/Code>/.exec(responseText)?.[1];

  if (code === "EntityTooLarge") {
    const proposed = Number(/<ProposedSize>(\d+)<\/ProposedSize>/.exec(responseText)?.[1] ?? 0);
    const allowed = Number(/<MaxSizeAllowed>(\d+)<\/MaxSizeAllowed>/.exec(responseText)?.[1] ?? 0);
    const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return proposed && allowed
      ? `That file is ${mb(proposed)} — the limit is ${mb(allowed)}.`
      : "That file is too large.";
  }

  if (code === "AccessDenied" || status === 403) {
    // The signature covers the content type, so a mismatch lands here too.
    return "That file type isn't allowed.";
  }

  return "Upload failed. Please try again.";
}
