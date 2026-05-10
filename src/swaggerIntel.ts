import { createHash } from "node:crypto";

/**
 * Stable response envelope for Swagger/OpenAPI intelligence MCP tools
 * (preview, upload-and-generate, impact analysis, API-project OpenAPI).
 */
export const SWAGGER_INTEL_CONTRACT_VERSION = "swagger_intel.v1" as const;

export function wrapSwaggerIntel(
  kind: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    contract_version: SWAGGER_INTEL_CONTRACT_VERSION,
    kind,
    ...payload,
  };
}

export function decodeSwaggerUploadBase64(
  base64: string
):
  | { ok: true; buf: Buffer; blob: Blob; sha256: string }
  | { ok: false; error: string } {
  try {
    const buf = Buffer.from(base64.replace(/\s/g, ""), "base64");
    if (!buf.length) {
      return { ok: false, error: "swagger_file_base64 decoded to an empty buffer" };
    }
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const blob = new Blob([buf]);
    return { ok: true, buf, blob, sha256 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
