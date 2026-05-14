# TestNeo MCP Server - IDE Setup

For product overview and **Cursor / Claude / VS Code** snippets, start with the hosted guide: **[testneo.ai/docs/testneo-mcp.html](https://testneo.ai/docs/testneo-mcp.html)**.

## 1) Build server (optional if you use `npx -y @testneo/mcp-server`)

From this repository’s root:

```bash
npm install
npm run build
```

## 2) Environment variables

- `TESTNEO_BASE_URL` — **`https://app.testneo.ai`** for TestNeo Cloud; or your self-hosted API URL (e.g. `http://localhost:8001` only for local API development).
- `TESTNEO_API_KEY` — create in the app after [signup](https://app.testneo.ai/signup).
- Optional: `TESTNEO_MCP_ALLOW_WRITE=true` to enable guarded write tools (still require `confirm=true` per call).
- Optional batch / agent routing: `TESTNEO_MCP_DEFAULT_EXECUTION_MODE`, `TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM`, `TESTNEO_MCP_PREFER_LOCAL_AGENT`, `TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH`, `TESTNEO_MCP_WAIT_FOR_AGENT_MS`, `TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE` (see package `docs/MCP_TOOL_REFERENCE.md`).

## 3) MCP command

**Recommended:** use `npx` as in the [hosted quickstart](https://testneo.ai/docs/testneo-mcp.html) (no path to this repo required).

**Local build:** point your IDE at:

```bash
node /absolute/path/to/this-repo/dist/index.js
```

## Suggested prompts

- "List my TestNeo projects."
- "Show recent failed executions for project 47."
- "Get summary and logs for execution SDKLOCAL_TC...."
- "Search failures in project 47 for checkout."
- "Get pass/fail trend for project 47 over 30d."
- "Get failure bundle for execution <execution_id>."
- "Run qa_intelligence_workflow for project 47."
- "Ingest Figma context for project 47 and create unified context named 'Figma — Checkout flow'."
- "List unified contexts for project 47."
- "Resolve unified context by name for project 47 — name_query 'figma checkout' (then use resolved_context_id for generation)."
- "Generate tests from unified context for project 47 using the resolved_context_id from testneo_get_unified_context_by_name, with auth_preamble preset saucedemo."
- "Preview generated tests as NLP and Playwright spec drafts."
- "Update NLP commands for test case 7708 with corrected checkout route."
- "Export test case 7708 as Playwright SDK spec."
- "Run Playwright spec preview for project 47 with confirm=true."
- "Run figma_to_tests_workflow for project 47 and show top 3 previews."
- "Trigger a Playwright execution in project 47 with these NLP commands (confirm=true)."
- "Call testneo_list_tests_by_tags for project 47 with tags [\"smoke\", \"@regression\"] and tag_match any; summarize ids and names."
- "Call testneo_get_local_agent_status and tell me if the local agent is connected."
- "With writes on: run testneo_run_batch_by_tags for project 47, tags [\"smoke\"], tag_match any, confirm true, idempotency_key \"ide-smoke-1\"."

## Write action guard

`testneo_trigger_playwright_execution` only executes when:

1. `TESTNEO_MCP_ALLOW_WRITE=true`
2. tool input includes `confirm=true`
