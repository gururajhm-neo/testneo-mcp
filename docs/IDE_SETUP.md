# TestNeo MCP Server - IDE Setup

## 1) Build server

```bash
cd packages/testneo-mcp-server
npm install
npm run build
```

## 2) Environment variables

- `TESTNEO_BASE_URL` (e.g. `http://localhost:8001`)
- `TESTNEO_API_KEY` (Bearer token)
- optional: `TESTNEO_MCP_ALLOW_WRITE=true` to enable trigger tool

## 3) MCP command

Use this command in your IDE MCP server config:

```bash
node /absolute/path/to/testneo-api/packages/testneo-mcp-server/dist/index.js
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
- "Generate tests from unified context for project 47 using the context_id returned by get_unified_context_by_name, with auth_preamble preset saucedemo."
- "Preview generated tests as NLP and Playwright spec drafts."
- "Update NLP commands for test case 7708 with corrected checkout route."
- "Export test case 7708 as Playwright SDK spec."
- "Run Playwright spec preview for project 47 with confirm=true."
- "Run figma_to_tests_workflow for project 47 and show top 3 previews."
- "Trigger a Playwright execution in project 47 with these NLP commands (confirm=true)."

## Write action guard

`testneo_trigger_playwright_execution` only executes when:

1. `TESTNEO_MCP_ALLOW_WRITE=true`
2. tool input includes `confirm=true`
