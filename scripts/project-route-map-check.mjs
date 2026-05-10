/**
 * Fast checks for project route-map parsing/build helpers (no TestNeo API).
 */
import assert from "node:assert/strict";
import {
  buildProjectSettingsWithRouteMap,
  parseProjectRouteConfig,
  projectRouteSettingsKey,
} from "../dist/projectRouteMap.js";

const parsed = parseProjectRouteConfig({
  project_settings: {
    [projectRouteSettingsKey()]: {
      enabled: true,
      profile: "saucedemo",
      extra_map: { "checkout summary": "checkout-step-two.html", products: "/inventory.html" },
    },
  },
});
assert.equal(parsed.enabled, true);
assert.equal(parsed.profile, "saucedemo");
assert.equal(parsed.extra_map["checkout summary"], "/checkout-step-two.html");
assert.equal(parsed.extra_map.products, "/inventory.html");

const built = buildProjectSettingsWithRouteMap(
  { theme: "dark" },
  { enabled: false, profile: "none", extra_map: { cart: "/cart.html" } }
);
assert.equal(built.theme, "dark");
assert.equal(built[projectRouteSettingsKey()].enabled, false);
assert.equal(built[projectRouteSettingsKey()].profile, "none");
assert.equal(built[projectRouteSettingsKey()].extra_map.cart, "/cart.html");
assert.ok(typeof built[projectRouteSettingsKey()].updated_at === "string");

process.stdout.write("project-route-map-check: OK\n");
