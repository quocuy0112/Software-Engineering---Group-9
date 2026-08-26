import "server-only";

import { noStoreHeaders } from "@/backend/security/response-headers";

export type ExportDownloadPayload = Readonly<{
  body: Buffer;
  fileName: string;
  mediaType: string;
}>;

export function exportDownloadResponse(result: ExportDownloadPayload) {
  const safeFileName = result.fileName.replaceAll(String.fromCharCode(34), "");
  const headers = new Headers(noStoreHeaders);
  headers.set("content-type", result.mediaType);
  headers.set(
    "content-disposition",
    "attachment; filename=" +
      String.fromCharCode(34) +
      safeFileName +
      String.fromCharCode(34),
  );
  headers.set("cache-control", "private, no-store");
  headers.set("content-length", String(result.body.byteLength));
  return new Response(new Uint8Array(result.body), { status: 200, headers });
}
