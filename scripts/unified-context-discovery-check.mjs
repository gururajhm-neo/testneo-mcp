/**
 * Unit-style checks for unified context name resolution (no TestNeo API).
 */
import assert from "node:assert/strict";
import { resolveUnifiedContextByName, normalizeContextQuery, rankNameMatch } from "../dist/unifiedContextDiscovery.js";

const base = (id, name, created) => ({
  id,
  name,
  created_at: created,
  entity_count: 1,
  relationship_count: 0,
  is_active: true,
});

assert.equal(normalizeContextQuery("  Foo   Bar  "), "foo bar");

assert.equal(rankNameMatch("Checkout Flow", "checkout flow"), 0);
assert.equal(rankNameMatch("Checkout Flow v2", "checkout"), 1);
assert.equal(rankNameMatch("My Checkout Flow", "checkout"), 2);
assert.equal(rankNameMatch("Payments", "checkout"), -1);

const items = [
  base(1, "Figma — Cart flow", "2025-01-01T00:00:00Z"),
  base(2, "Figma Cart flow copy", "2025-02-01T00:00:00Z"),
];

let r = resolveUnifiedContextByName(items, "cart", "auto");
assert.ok(!r.chosen, "auto should be ambiguous when two include 'cart'");
assert.ok(r.candidates_same_tier.length >= 2);

r = resolveUnifiedContextByName(items, "cart", "auto", { prefer_context_id: 2 });
assert.equal(r.chosen?.id, 2);

r = resolveUnifiedContextByName(items, "Figma Cart flow copy", "exact");
assert.equal(r.chosen?.id, 2);

r = resolveUnifiedContextByName([{ ...base(3, "X", "2025-03-01"), is_active: false }], "x", "substring");
assert.ok(!r.chosen, "inactive filtered out");

process.stdout.write("unified-context-discovery-check: OK\n");
