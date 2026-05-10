"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SWAGGER_INTEL_CONTRACT_VERSION = void 0;
exports.wrapSwaggerIntel = wrapSwaggerIntel;
exports.decodeSwaggerUploadBase64 = decodeSwaggerUploadBase64;
exports.sha256Utf8 = sha256Utf8;
const node_crypto_1 = require("node:crypto");
/**
 * Stable response envelope for Swagger/OpenAPI intelligence MCP tools
 * (preview, upload-and-generate, impact analysis, API-project OpenAPI).
 */
exports.SWAGGER_INTEL_CONTRACT_VERSION = "swagger_intel.v1";
function wrapSwaggerIntel(kind, payload) {
    return {
        contract_version: exports.SWAGGER_INTEL_CONTRACT_VERSION,
        kind,
        ...payload,
    };
}
function decodeSwaggerUploadBase64(base64) {
    try {
        const buf = Buffer.from(base64.replace(/\s/g, ""), "base64");
        if (!buf.length) {
            return { ok: false, error: "swagger_file_base64 decoded to an empty buffer" };
        }
        const sha256 = (0, node_crypto_1.createHash)("sha256").update(buf).digest("hex");
        const blob = new Blob([buf]);
        return { ok: true, buf, blob, sha256 };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
function sha256Utf8(text) {
    return (0, node_crypto_1.createHash)("sha256").update(text, "utf8").digest("hex");
}
