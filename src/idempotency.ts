import { createHash } from "node:crypto";

type IdempotencyRecord = {
  fingerprint: string;
  createdAtMs: number;
  responseText: string;
};

const store = new Map<string, IdempotencyRecord>();
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function prune(ttlMs: number): void {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now - v.createdAtMs > ttlMs) store.delete(k);
  }
}

export function makeIdempotencyFingerprint(input: unknown): string {
  const json = JSON.stringify(input, Object.keys((input as Record<string, unknown>) || {}).sort());
  return createHash("sha256").update(json || "").digest("hex");
}

export function checkIdempotency(
  key: string,
  fingerprint: string,
  ttlMs: number = DEFAULT_TTL_MS
): { ok: true; replay?: string } | { ok: false; reason: "conflict"; message: string } {
  prune(ttlMs);
  const found = store.get(key);
  if (!found) return { ok: true };
  if (found.fingerprint !== fingerprint) {
    return {
      ok: false,
      reason: "conflict",
      message:
        "This idempotency_key was already used with different input. Use a new key for a new request shape.",
    };
  }
  return { ok: true, replay: found.responseText };
}

export function recordIdempotency(
  key: string,
  fingerprint: string,
  responseText: string,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  prune(ttlMs);
  store.set(key, {
    fingerprint,
    createdAtMs: Date.now(),
    responseText: responseText.slice(0, 200_000),
  });
}

