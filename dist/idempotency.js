"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeIdempotencyFingerprint = makeIdempotencyFingerprint;
exports.checkIdempotency = checkIdempotency;
exports.recordIdempotency = recordIdempotency;
const node_crypto_1 = require("node:crypto");
const store = new Map();
const DEFAULT_TTL_MS = 30 * 60 * 1000;
function prune(ttlMs) {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
        if (now - v.createdAtMs > ttlMs)
            store.delete(k);
    }
}
function makeIdempotencyFingerprint(input) {
    const json = JSON.stringify(input, Object.keys(input || {}).sort());
    return (0, node_crypto_1.createHash)("sha256").update(json || "").digest("hex");
}
function checkIdempotency(key, fingerprint, ttlMs = DEFAULT_TTL_MS) {
    prune(ttlMs);
    const found = store.get(key);
    if (!found)
        return { ok: true };
    if (found.fingerprint !== fingerprint) {
        return {
            ok: false,
            reason: "conflict",
            message: "This idempotency_key was already used with different input. Use a new key for a new request shape.",
        };
    }
    return { ok: true, replay: found.responseText };
}
function recordIdempotency(key, fingerprint, responseText, ttlMs = DEFAULT_TTL_MS) {
    prune(ttlMs);
    store.set(key, {
        fingerprint,
        createdAtMs: Date.now(),
        responseText: responseText.slice(0, 200_000),
    });
}
