import assert from "node:assert/strict";
import {
  decodeSwaggerUploadBase64,
  sha256Utf8,
  SWAGGER_INTEL_CONTRACT_VERSION,
  wrapSwaggerIntel,
} from "../dist/swaggerIntel.js";

const w = wrapSwaggerIntel("test", { a: 1 });
assert.equal(w.contract_version, SWAGGER_INTEL_CONTRACT_VERSION);
assert.equal(w.kind, "test");
assert.equal(w.a, 1);

assert.equal(sha256Utf8("hello"), sha256Utf8("hello"));

const emptyB64 = Buffer.from("").toString("base64");
let dec = decodeSwaggerUploadBase64(emptyB64);
assert.equal(dec.ok, false);

dec = decodeSwaggerUploadBase64(Buffer.from("{}").toString("base64"));
assert.equal(dec.ok, true);
assert.ok(dec.sha256.length === 64);

console.log("swagger-intel-check: OK");
