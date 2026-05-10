import assert from "node:assert/strict";
import { loadConfig } from "../dist/config.js";
import { inferRequiresAuthFromNlp } from "../dist/policyEngine.js";

const saved = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key];
  }
  for (const [k, v] of Object.entries(saved)) {
    process.env[k] = v;
  }
}

try {
  process.env.TESTNEO_BASE_URL = "http://localhost:8001";
  process.env.TESTNEO_API_KEY = "tn_test_key_12345";
  delete process.env.TESTNEO_MCP_POLICY_MODE;
  let c = loadConfig(process.env);
  assert.equal(c.policyMode, "strict");

  process.env.TESTNEO_MCP_POLICY_MODE = "warn";
  c = loadConfig(process.env);
  assert.equal(c.policyMode, "warn");

  assert.equal(inferRequiresAuthFromNlp(["Navigate to {{base_url}}", "Click checkout"]), false);
  assert.equal(inferRequiresAuthFromNlp(["Fill Username with \"u\"", "Fill Password with \"p\"", "Click Login"]), true);
  assert.equal(inferRequiresAuthFromNlp(["Sign in as admin"]), true);

  process.stdout.write("policy-engine-check: OK\n");
} finally {
  restoreEnv();
}

