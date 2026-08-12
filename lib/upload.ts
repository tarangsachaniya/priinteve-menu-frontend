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
  file: File,
  endpoint: string,
  options?: { extra?: Record<string, string>; onProgress?: (percent: number) => void },
): Promise<DirectUploadResult> {
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
      // 403 here is almost always a violated condition — the file was larger
      // than the signed limit, or its type did not match what was authorised.
      reject(new Error(xhr.status === 403 ? "File rejected (too large or wrong type)" : "Upload failed"));
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.send(body);
  });
}
