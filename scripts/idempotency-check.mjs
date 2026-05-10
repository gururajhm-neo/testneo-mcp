import assert from "node:assert/strict";
import { checkIdempotency, makeIdempotencyFingerprint, recordIdempotency } from "../dist/idempotency.js";

const key = "tool:key-123";
const fpA = makeIdempotencyFingerprint({ a: 1, b: 2 });
const fpA2 = makeIdempotencyFingerprint({ b: 2, a: 1 });
const fpB = makeIdempotencyFingerprint({ a: 2 });

assert.equal(fpA, fpA2);

let c = checkIdempotency(key, fpA);
assert.equal(c.ok, true);
assert.equal(c.replay, undefined);

recordIdempotency(key, fpA, JSON.stringify({ accepted: true }));

c = checkIdempotency(key, fpA);
assert.equal(c.ok, true);
assert.ok(typeof c.replay === "string");

const conflict = checkIdempotency(key, fpB);
assert.equal(conflict.ok, false);
assert.equal(conflict.reason, "conflict");

process.stdout.write("idempotency-check: OK\n");

