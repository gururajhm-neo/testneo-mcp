export declare function makeIdempotencyFingerprint(input: unknown): string;
export declare function checkIdempotency(key: string, fingerprint: string, ttlMs?: number): {
    ok: true;
    replay?: string;
} | {
    ok: false;
    reason: "conflict";
    message: string;
};
export declare function recordIdempotency(key: string, fingerprint: string, responseText: string, ttlMs?: number): void;
