/**
 * Fast checks for route hardening + related config (no TestNeo API).
 * Run from package root after build: `npm test` (see package.json).
 */
import assert from "node:assert/strict";
import { loadConfig } from "../dist/config.js";
import {
  hardenNavigationCommands,
  resolvePhraseToPathMap,
  normalizeNavigatePhrase,
} from "../dist/routeHardening.js";

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

  process.env.TESTNEO_ROUTE_HARDENING = "false";
  process.env.TESTNEO_ROUTE_PROFILE = "saucedemo";
  process.env.TESTNEO_ROUTE_MAP_JSON = JSON.stringify({ foo: "/bar" });
  let c = loadConfig(process.env);
  assert.equal(c.routeHardeningEnabled, false);
  assert.equal(c.routeProfile, "saucedemo");
  assert.equal(c.routeMapCustom.foo, "/bar");

  process.env.TESTNEO_ROUTE_HARDENING = "true";
  process.env.TESTNEO_ROUTE_PROFILE = "none";
  c = loadConfig(process.env);
  assert.equal(c.routeHardeningEnabled, true);

  let m = resolvePhraseToPathMap({
    enabled: c.routeHardeningEnabled,
    profile: c.routeProfile,
    customMap: c.routeMapCustom,
  });
  assert.equal(m[normalizeNavigatePhrase("foo")], "/bar");

  m = resolvePhraseToPathMap({ enabled: false, profile: "saucedemo", customMap: {} });
  assert.deepEqual(m, {});

  m = resolvePhraseToPathMap({
    enabled: true,
    profile: "saucedemo",
    customMap: { "checkout overview": "/custom" },
  });
  assert.equal(m[normalizeNavigatePhrase("checkout overview")], "/custom", "custom overrides preset");

  const cmds = [
    "Click login",
    "Navigate to https://example.com/x",
    "Navigate to {{base_url}}/already",
    "Navigate to /static/path.html",
    "Navigate to the Checkout Overview screen",
    "Navigate to unknown galaxy",
  ];
  const saucedemoMap = resolvePhraseToPathMap({ enabled: true, profile: "saucedemo", customMap: {} });
  const h = hardenNavigationCommands(cmds, saucedemoMap);
  assert.equal(h.commands[0], cmds[0]);
  assert.equal(h.commands[1], cmds[1]);
  assert.equal(h.commands[2], cmds[2]);
  assert.equal(h.commands[3], cmds[3]);
  assert.ok(h.commands[4].includes("checkout-step-two.html"), h.commands[4]);
  assert.equal(h.commands[5], cmds[5]);
  assert.equal(h.replacements.length, 1);

  const full = resolvePhraseToPathMap({ enabled: true, profile: "saucedemo", customMap: {} });
  const hProducts = hardenNavigationCommands(["Navigate to Products"], full);
  assert.ok(hProducts.commands[0].includes("inventory.html"));

  process.stdout.write("route-hardening-check: OK\n");
} finally {
  restoreEnv();
}
