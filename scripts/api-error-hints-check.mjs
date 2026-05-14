/**
 * Smoke checks for apiErrorHints (run after `npm run build` in this package).
 */
import assert from "node:assert/strict";
import { buildAgentFacingHttpEnvelope, summarizeTestNeoHttpError } from "../dist/apiErrorHints.js";

const a = summarizeTestNeoHttpError(
  403,
  JSON.stringify({
    detail: {
      message: "Daily api chat limit reached",
      error: "daily_chat_limit_reached",
      error_code: "CHAT_LIMIT_EXCEEDED",
      current: 10,
      limit: 10,
      upgrade_url: "/pricing",
      upgrade_required: true,
      usage_info: { daily_limit: 10, current_usage: 10 },
    },
  })
);
assert.ok(a);
assert.ok(a.includes("Daily api"));
assert.ok(a.includes("CHAT_LIMIT_EXCEEDED") || a.includes("code:"));
assert.ok(a.includes("/pricing"));

const b = summarizeTestNeoHttpError(
  403,
  JSON.stringify({
    error: "Trial ended",
    trial_expired: true,
  })
);
assert.ok(b && b.includes("Trial"));

const c = summarizeTestNeoHttpError(
  429,
  JSON.stringify({
    error: "Too many uploads",
    upgrade_required: true,
    upgrade_url: "/pricing",
    limit_info: { current: 5, limit: 5 },
  })
);
assert.ok(c && c.includes("Too many"));

const env = buildAgentFacingHttpEnvelope(404, "/api/web/v1/agents/my-agent", "{}", {
  agentSetupUrl: "https://app.testneo.ai/web/agent",
});
assert.equal(env.contract_version, "testneo_mcp_http_error.v1");
assert.equal(env.http_status, 404);
assert.ok(Array.isArray(env.next_steps));

console.log("apiErrorHints checks OK");
