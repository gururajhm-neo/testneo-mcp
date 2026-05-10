/**
 * Regression checks for project execution preconditions (no TestNeo API).
 * Run from package root after build: `npm test` (see package.json).
 */
import assert from "node:assert/strict";
import { loadConfig } from "../dist/config.js";
import { classifyExecutableBaseUrl } from "../dist/projectPreconditions.js";

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
  delete process.env.TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS;

  let c = loadConfig(process.env);
  assert.equal(c.relaxProjectPreconditions, false);

  process.env.TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS = "true";
  c = loadConfig(process.env);
  assert.equal(c.relaxProjectPreconditions, true);

  assert.equal(classifyExecutableBaseUrl(""), null);
  assert.equal(classifyExecutableBaseUrl("   "), null);
  assert.equal(classifyExecutableBaseUrl("https://example.com"), null);
  assert.equal(classifyExecutableBaseUrl("http://example.com/path"), null);
  assert.ok(classifyExecutableBaseUrl("https://www.saucedemo.com")?.resolved_base_url);
  assert.ok(classifyExecutableBaseUrl("http://localhost:3000/app")?.resolved_base_url);
  assert.ok(classifyExecutableBaseUrl("app.staging.example.com")?.resolved_base_url);

  process.stdout.write("project-preconditions-check: OK\n");
} finally {
  restoreEnv();
}
