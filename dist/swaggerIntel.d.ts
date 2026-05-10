/**
 * Stable response envelope for Swagger/OpenAPI intelligence MCP tools
 * (preview, upload-and-generate, impact analysis, API-project OpenAPI).
 */
export declare const SWAGGER_INTEL_CONTRACT_VERSION: "swagger_intel.v1";
export declare function wrapSwaggerIntel(kind: string, payload: Record<string, unknown>): Record<string, unknown>;
export declare function decodeSwaggerUploadBase64(base64: string): {
    ok: true;
    buf: Buffer;
    blob: Blob;
    sha256: string;
} | {
    ok: false;
    error: string;
};
export declare function sha256Utf8(text: string): string;
