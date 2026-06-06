# TestNeo MCP Tool Reference

**Canonical document** (for **testneo.ai** / marketing / git): **`docs/mcp/mcp-tool-reference.md`** in the TestNeo API monorepo. The MCP server in **`packages/testneo-mcp-server`** exposes **65** tools, all prefixed with `testneo_`. The **`@testneo/mcp-server`** npm package ships the **same** Markdown as **`packages/testneo-mcp-server/docs/MCP_TOOL_REFERENCE.md`** — copy from this file before publish (see **Website and npm package sync** at the end of this page).

**Agent workflows:** `qa_intelligence_workflow`, `triage_failure_workflow`, and `rerun_decision_workflow` are **not** separate tool names. They are values of **`workflow_type`** on **`testneo_run_agent_workflow`** (see [Agent workflow tool](#agent-workflow-tool-testneo_run_agent_workflow)).

## Alphabetical index (all tools)

`testneo_ai_assistant_query` · `testneo_api_project_openapi_impact` · `testneo_api_project_upload_openapi` · `testneo_apply_route_hardening` · `testneo_bootstrap_web_mcp_project` · `testneo_create_web_project` · `testneo_create_web_project_environment` · `testneo_delete_saved_api_test_chain` · `testneo_execute_generated_test_case` · `testneo_explain_failure` · `testneo_export_playwright_spec` · `testneo_figma_image_to_tests_workflow` · `testneo_figma_to_tests_workflow` · `testneo_find_test_cases` · `testneo_generate_tests_from_context` · `testneo_get_execution_logs` · `testneo_get_execution_status` · `testneo_get_execution_summary` · `testneo_get_failure_bundle` · `testneo_get_incident_matches` · `testneo_get_local_agent_status` · `testneo_get_pass_fail_trend` · `testneo_get_pr_validation_detail` · `testneo_get_pr_validation_history` · `testneo_get_project_route_map` · `testneo_get_risk_signals` · `testneo_get_unified_context_by_name` · `testneo_ingest_confluence` · `testneo_ingest_engineering_memory_csv` · `testneo_ingest_figma_context` · `testneo_ingest_postmortem` · `testneo_list_engineering_memory` · `testneo_list_projects` · `testneo_list_recent_executions` · `testneo_list_saved_api_test_chains` · `testneo_list_tests_by_tags` · `testneo_list_unified_contexts` · `testneo_pr_validation_workflow` · `testneo_preview_generated_tests` · `testneo_rerun_failed` · `testneo_run_agent_workflow` · `testneo_run_api_test_chain` · `testneo_run_batch_by_tags` · `testneo_run_generated_test_pipeline` · `testneo_run_playwright_spec_preview` · `testneo_save_api_test_chain` · `testneo_search_failures` · `testneo_set_project_route_map` · `testneo_suggest_api_test_chains` · `testneo_suggest_fix` · `testneo_swagger_impact_actions` · `testneo_swagger_impact_analysis` · `testneo_swagger_preview` · `testneo_swagger_upload_and_generate` · `testneo_sync_engineering_memory` · `testneo_trigger_playwright_execution` · `testneo_update_test_case_nlp` · `testneo_validate_connection` · `testneo_validate_pr` · `testneo_watch_execution`

## PR Validation & Release Confidence

Seven tools that turn any MCP-compatible IDE into a full **release-confidence engine**: impact analysis → risk scoring → AI-quality root causes → prioritised fix plan — all in one chat thread. Works in Cursor, VS Code + Copilot, Windsurf, Claude Code, Cline, and any other MCP client. IDE playbook files are pre-configured in the TestNeo API repo (`.cursor/rules/`, `.github/copilot-instructions.md`, `AGENTS.md`, `.vscode/mcp.json`).

**Chat recipes:** [MCP Workflow 7](./mcp-workflows.md#workflow-7-pr-validation--release-brief-release-intelligence) (PR validate) · [Workflow 8](./mcp-workflows.md#workflow-8-engineering-memory--live-pr-matches) (Engineering Memory) · [Workflow 9](./mcp-workflows.md#workflow-9-release-confidence-qa-lead--pm) (ship confidence) · [Workflow 10](./mcp-workflows.md#workflow-10-patterns--outcome-learning) (patterns + outcome learning) · [Workflow 11](./mcp-workflows.md#workflow-11-post-ship-webhooks-jira--pagerduty) (post-ship webhooks).

### Risk levels

| Level | Score | Signal | Meaning |
|-------|-------|--------|---------|
| 🟢 PASS | 0–34 | `clean` | Low verification risk; safe to merge after standard review |
| 🟡 WARN | 35–69 | `review` | Run impacted validation stages before merging |
| 🔴 BLOCK | 70–100 | `block` | Blocking findings; hold the release |

### Risk score factors (weights sum to 1.0)

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| `blast_radius` | 0.25 | Affected test count × impact level × change density |
| `historical_failure_rate` | 0.22 | Per-test 7d failure rates, flakiness scores, recent failures |
| `critical_path_coverage` | 0.18 | Payment, auth, checkout, billing, pricing file patterns |
| `component_history` | 0.13 | Project-wide component failure rates + trend (worsening/stable) |
| `dependency_blast` | 0.12 | Transitive import depth + distinct components in blast radius |
| `verification_coverage_gap` | 0.10 | % of impacted tests with linked TestNeo test case IDs |

### PR Validation tools

- **`testneo_pr_validation_workflow`** — **Primary entry point** (write-guarded for test execution; planning + risk scoring always run). One-shot Release Brief: runs impact analysis, risk scoring, `DataDrivenClaudeAnalyzer` (inline AI analysis — no external LLM), failure explanations, and prioritised fix plan in a single call. Returns a structured document with risk score, PASS/WARN/BLOCK signal, risk factor breakdown, component health snapshot, per-finding root causes, NOW/NEXT fix plan, and ready-to-paste PR comment draft. Set `confirm: true` + `TESTNEO_MCP_ALLOW_WRITE=true` to also execute impacted tests.

- **`testneo_validate_pr`** — Raw `pr_validation.v1` contract. Runs `PrValidationOrchestrator` directly: impact analysis → risk scoring → AI analysis → optional test execution. Returns `workflow_id`, full findings array, `claude_analysis`, `comment_draft`, and `ai_ready_summary` with all risk factors. Use `testneo_pr_validation_workflow` for the full IDE experience; use this when you need the raw JSON contract.

- **`testneo_explain_failure`** — Read-only. Deep-dive per-finding explanation for a `workflow_id`. Synthesises historical failure rates, component risk trends, transitive blast radius provenance, and changed-file context into plain-English root cause analysis and concrete "what to do next" steps with test IDs to rerun.

- **`testneo_suggest_fix`** — Read-only. Prioritised two-tier fix plan from a `workflow_id`: **NOW** (blocking — must resolve before merge) and **NEXT** (warning — safe to defer). Includes file-level hints, test IDs to rerun, and a complete rerun strategy.

- **`testneo_get_pr_validation_history`** — Read-only. Recent validation run history for a project: risk scores, merge signals, statuses, and PR refs. Foundation for Release Memory — answers "what was the risk last time we touched this file?"

- **`testneo_get_pr_validation_detail`** — Read-only. Full stored `WorkflowContext` for a specific `workflow_id`: all findings, risk factors, blast radius snapshot, component health snapshot, and (optionally) the complete audit event trail. Mirrors the web PR Validation board at `/web/pr-validation/:workflowId`.

- **`testneo_get_risk_signals`** — Read-only. Per-test flakiness scores and 7-day/30-day failure rates for specific test IDs. Call before `testneo_validate_pr` to understand which tests are historically risky. Inputs: `project_id` + `test_ids` array.

- **`testneo_get_incident_matches`** — Read-only. **Engineering Memory** lookup without a full validation run. Connects prior `WorkflowContext` validations, `FailurePattern` clusters, and `TestFailureResolution` records to changed files, components, or test IDs. Returns incident match score (0–100), ranked matches, and top prior fix. Also included automatically in every `testneo_pr_validation_workflow` Release Brief.

- **`testneo_ingest_engineering_memory_csv`** — Write (no `confirm` flag). Upload a bug-report CSV from the IDE workspace into Engineering Memory. Args: `project_id` + `csv_path` (workspace-relative) **or** `csv_file_base64` + `csv_filename`. Backend: `POST /api/web/v1/engineering-memory/ingest/csv`. Matching to PRs is automatic via changed-file overlap — bugs are not tagged with PR numbers.

- **`testneo_sync_engineering_memory`** — Write. Sync Jira bugs into Engineering Memory (requires Jira connected in project settings).

- **`testneo_list_engineering_memory`** — Read-only. List ingested memory entries (`bug_csv`, `jira`, `postmortem_upload`). Optional filters: `source`, `area`, **`pattern_id`**.

- **`testneo_list_engineering_memory_patterns`** — Read-only. Unified failure patterns with `source_mix`, **trend** (30d vs prior 30d), `best_resolution`. Pass **`pattern_id`** for full detail + contributing entries. Backend: `GET …/engineering-memory/patterns`.

- **`testneo_refresh_engineering_memory_patterns`** — Write (no confirm). Re-cluster entries into patterns and refresh aggregates. Backend: `POST …/engineering-memory/patterns/refresh`.

- **`testneo_ingest_postmortem`** — Write (no `confirm` flag). Ingest a postmortem / RCA into Engineering Memory. Args: `project_id` + `title` + `body` **or** `md_path` (workspace-relative `.md`). Optional `external_id` for stable upsert. Extracts impact areas, root cause, resolution actions, and **related file paths** for deterministic PR matching. Backend: `POST /api/web/v1/engineering-memory/ingest/postmortem`. Preview: `POST …/ingest/postmortem/preview`.

- **`testneo_ingest_confluence`** — Write (no `confirm` flag). Import a Confluence postmortem page by **page id** or full URL. Uses the same Atlassian credentials as Jira Integration. Backend: `POST /api/web/v1/engineering-memory/ingest/confluence`.

**Auto confidence bump (5a):** When a PR re-validation completes **PASS/WARN** after a prior **BLOCK** on the same PR, the API bumps matching pattern `confidence` and `resolution_count` automatically — no MCP call required.

### Release bundle, gate, and outcome learning (Phase 5)

- **`testneo_create_release_bundle`** — Create a named release candidate scored against specific PR validation workflow IDs. Returns `bundle_id`, confidence, unlock actions.

- **`testneo_get_release_readiness`** — Aggregate or bundle-scoped release confidence (0–100).

- **`testneo_generate_release_brief`** — AI release brief with go/no-go, checklist, density narrative.

- **`testneo_evaluate_release_gate`** — Evaluate gate policy for a bundle (`GATE_PASS` | `GATE_BLOCK` | `GATE_WARN`). **GATE_PASS** stubs a `release_outcomes` row for learning.

- **`testneo_record_release_outcome`** — Mark deployed (POST) or record post-ship signals (PATCH with `outcome_id`: rollback, incident 7d/30d, hotfixes).

- **`testneo_get_release_outcomes`** — List ship snapshots and recorded outcomes for a project.

- **`testneo_get_release_calibration`** — Read-only suggestions from historical outcomes (e.g. “Ignored HIGH memory patterns → 3× rollback”). Never auto-changes policy.

### Post-ship webhooks (Jira + PagerDuty — Phase 5 extension)

Production signals pre-fill the **open release outcome stub** (created by `GATE_PASS` or Mark deployed). Jira webhooks also ingest **Engineering Memory**. User still **`testneo_record_release_outcome`** to finalize.

- **`testneo_get_release_webhook_config`** — Read-only. Webhook URLs, Jira match rules, PagerDuty connection status, open stub readiness. Parity with Release Readiness → Post-ship webhooks panel.

- **`testneo_test_release_webhook`** — Send demo `jira` or `pagerduty` event through the production pipeline (no ngrok). Pre-fills notes and incident flags on the open stub. Requires open outcome stub.

**Migration (self-hosted):** `migrations/add_release_webhooks.sql`

**Web UI:** `/web/release-readiness?project_id=<ID>` → Post-ship webhooks → **Send test Jira/PagerDuty event**

**Orchestration:** [Workflow 11](./mcp-workflows.md#workflow-11-post-ship-webhooks-jira--pagerduty) · [EM9 prompt](./mcp-prompt-packs.md#em9--post-ship-webhooks-demo-qa-lead--em) · [Scenario F demo](../demo/PROJECT10_ENGINEERING_MEMORY_TEST.md#demo-scenario-f--post-ship-webhooks-phase-5-extension) · [Release 2.1 shipped](../product/RELEASE_2_1_ENGINEERING_MEMORY_SHIPPED.md)

### Release 2.2 — planned MCP tools (Phase 6A — not implemented)

| Tool (planned) | Purpose |
|----------------|---------|
| `testneo_mirror_test_failures_to_engineering_memory` | Promote test failure clusters → EM entries |
| `testneo_get_release_webhook_deliveries` | Audit last N webhook deliveries per project |

See [Workflow 12](./mcp-workflows.md#workflow-12-learning-loop-hardening-release-22--planned) · [Phase 6A spec](../product/ENGINEERING_MEMORY_PHASES_2_5_MASTER_PLAN.md#phase-6a--learning-loop-hardening-release-22-planned)

### IDE workflow: bug CSV → instant PR analysis

```
Developer in Cursor / VS Code:
  "Upload bugs.csv and validate my PR"
    ↓
testneo_pr_validation_workflow(
  project_id,
  repository, pull_request, git,
  engineering_memory_csv_path: "bugs/orders_incidents.csv",  ← optional one-shot
  confirm: false
)
    ↓
Step 0: CSV → engineering_memory_entries (sync ingest)
Step 1: validate_pr + incident-context lookup (changed files vs memory)
    ↓
Release Brief includes:
  📥 Engineering Memory ingest summary
  🔁 Historical Incident Matches (live scores)
```

Or two-step: `testneo_ingest_engineering_memory_csv` then `testneo_pr_validation_workflow`.

### Jira auto-sync before validate (Phase A — default ON)

`testneo_pr_validation_workflow` runs **Jira → Engineering Memory sync first** when `sync_jira_before_validate` is true (default). No separate sync step in the IDE.

```
Developer: "validate my PR"
  ↓
testneo_pr_validation_workflow(project_id, repository, pull_request, git, confirm: false)
  ↓
Step 0a: Jira bugs/incidents → engineering_memory_entries (skipped if Jira not connected)
Step 0b: optional engineering_memory_csv_path
Step 1: validate_pr + incident-context lookup
```

Set `sync_jira_before_validate: false` to skip. GitHub webhooks use the same flag in **Project → GitHub Release Intelligence → Sync Jira bugs before validate**.

### One-shot IDE workflow

```
Developer: "validate my PR" (in Cursor, VS Code + Copilot, Windsurf, etc.)
  ↓
IDE AI detects git context:
  git rev-parse HEAD                    → head_sha
  git merge-base HEAD origin/main       → base_sha
  git diff --name-status <base> HEAD    → changed_files
  git remote get-url origin             → owner/name
  ↓
testneo_pr_validation_workflow(project_id, repository, pull_request, git, confirm: false)
  ↓
Release Brief displayed in chat:
  🔴 BLOCK / 🟡 WARN / 🟢 PASS + risk score
  Historical Incident Matches (Engineering Memory)
  Risk factor breakdown
  Component health snapshot
  Per-finding root cause (AI-quality, data-driven)
  NOW/NEXT fix plan
  PR comment draft (ready to paste)
  ↓
If BLOCK:
  testneo_explain_failure(workflow_id)   → deep root cause per finding
  testneo_suggest_fix(workflow_id)       → prioritised fix plan + rerun strategy
```

### Example inputs

**`testneo_pr_validation_workflow`**
```json
{
  "project_id": 47,
  "repository": { "owner": "acme", "name": "shop-web" },
  "pull_request": { "number": 142 },
  "git": {
    "base_sha": "a1b2c3d",
    "head_sha": "f4e5d6c",
    "changed_files": [
      { "path": "src/checkout/CheckoutService.ts", "status": "modified", "additions": 22, "deletions": 8 },
      { "path": "src/auth/tokenRefresh.ts", "status": "modified", "additions": 45, "deletions": 12 }
    ]
  },
  "execution": { "run_impacted_tests": true },
  "sync_jira_before_validate": true,
  "jira_sync_max_issues": 50,
  "jira_sync_lookback_days": 90,
  "engineering_memory_csv_path": "scripts/fixtures/project10_engineering_memory_bugs.csv",
  "confirm": false
}
```

**`testneo_ingest_engineering_memory_csv`**
```json
{
  "project_id": 10,
  "csv_path": "scripts/fixtures/project10_engineering_memory_bugs.csv"
}
```

**`testneo_explain_failure`**
```json
{
  "workflow_id": "e61bd584-f1b8-427b-abfd-1ab05c419667",
  "include_rerun_plan": true
}
```

**`testneo_suggest_fix`**
```json
{
  "workflow_id": "e61bd584-f1b8-427b-abfd-1ab05c419667",
  "priority_filter": "now"
}
```

**`testneo_get_pr_validation_history`**
```json
{
  "project_id": 47,
  "limit": 10
}
```

**`testneo_get_risk_signals`**
```json
{
  "project_id": 47,
  "test_ids": [7712, 7809, 7903]
}
```

---

## Read/Analysis Tools
- `testneo_validate_connection`
- `testneo_ai_assistant_query` — **Web AI Assistant** parity: `POST /api/web/v1/etl/ai-assistant/query` with `project_id`, natural-language `query`, optional **`context_id`** or **`context_name_query`** (+ `context_match_mode`), optional **`response_style`** (`concise` \| `detailed`), optional **`recommend_context`** / **`rag_context`** JSON bodies (same as UI). Counts against Web AI chat limits. Returns **`assistant_reply`**, **`product_navigation.web_ai_assistant_url`**, and **`upstream`** (full API payload including `usage` when present). **Prompt library & personas:** [Web AI Assistant & prompt library](./MCP_AI_ASSISTANT_AND_PROMPTS.md).
- `testneo_get_local_agent_status` — self-hosted agent registered + heartbeat; **`setup_url`** for install/connect (same origin as **`TESTNEO_BASE_URL`**).
- `testneo_list_projects`
- `testneo_get_project_route_map`
- `testneo_list_recent_executions`
- `testneo_list_saved_api_test_chains` — **`GET /api/web/v1/projects/{id}/api-test-chains`**; user-saved ordered suites (`test_case_ids`).
- `testneo_suggest_api_test_chains` — **`GET …/api-test-chains/suggest`**; classifier/Swagger-folder **business-flow** chains and phases for NLP API-style web tests (same ordering intelligence as the Multi Test Runner scan).
- `testneo_list_tests_by_tags` — resolve **`@tag`** / plain tags via **`GET /api/web/v1/test-cases/?tag_filter=`** (per tag); **`tag_match`**: `any` \| `all`.
- `testneo_find_test_cases` — **`GET /api/web/v1/test-cases/?search=`** + **`project_id`**; returns **`id`**, **`name`**, **`tags`** for UI / disambiguation before execute.
- `testneo_get_execution_status`
- `testneo_get_execution_summary`
- `testneo_get_execution_logs`
- `testneo_search_failures`
- `testneo_get_pass_fail_trend`
- `testneo_watch_execution`
- `testneo_get_failure_bundle`
- `testneo_run_agent_workflow` — multi-step QA workflow over project data; see [Agent workflow tool](#agent-workflow-tool-testneo_run_agent_workflow).

## Context/Test Generation Tools
- `testneo_list_unified_contexts`
- `testneo_get_unified_context_by_name`
- `testneo_ingest_figma_context`
- `testneo_figma_to_tests_workflow` — **Figma API token** path: metadata ingest → context → generate.
- `testneo_figma_image_to_tests_workflow` — **PNG/JPEG export** path (same as product “Upload Figma Image”): multipart upload → vision ETL → unified context → generate (no Figma token).
- `testneo_generate_tests_from_context`
- `testneo_preview_generated_tests`
- `testneo_apply_route_hardening`
- `testneo_set_project_route_map`

## Swagger / OpenAPI intelligence (web + API projects)
- `testneo_swagger_preview` — parse Swagger/OpenAPI from **base64** (read-only).
- `testneo_swagger_upload_and_generate` — **web project**: Swagger + optional business rules → unified context + NLP web tests (multipart; guarded write).
- `testneo_swagger_impact_analysis` — **web project**: diff new spec vs snapshot; list impacted swagger-sourced tests (guarded write; persists spec state).
- `testneo_swagger_impact_actions` — bulk `mark_stale` / `archive` / `keep` after triage (guarded write).
- `testneo_api_project_upload_openapi` — **classic API project**: store OpenAPI on `Project.openapi_spec` (guarded write).
- `testneo_api_project_openapi_impact` — **API project**: OpenAPI impact vs stored or inline spec (guarded write).

Responses include a stable envelope: **`contract_version: swagger_intel.v1`** plus **`kind`** (preview / upload_and_generate / …). Multipart tools use **`TESTNEO_MCP_SWAGGER_TIMEOUT_MS`** (default 120000 ms) instead of the default HTTP timeout.

## Script/Editing Tools
- `testneo_update_test_case_nlp`
- `testneo_export_playwright_spec`
- `testneo_run_playwright_spec_preview`

## Write/Execution Tools (Guarded)

These require write enablement + confirmation where `confirm` is supported:

- `TESTNEO_MCP_ALLOW_WRITE=true`
- `confirm=true` (per tool, when applicable)

| Tool | Notes |
| --- | --- |
| `testneo_create_web_project` | `POST /api/web/v1/projects`; requires **`website_url`**. MCP sends **`create_default_environment`** (default **true**), optional **`initial_environment`**, **`environment_username`** / **`environment_password`**, **`project_environment_name`**, **`base_url_variable_name`** — **single transaction** when the API supports the extended schema. Otherwise create env with **`testneo_create_web_project_environment`**. New projects: **`lighthouse_enabled`** default **true** when the API includes that merge. |
| `testneo_create_web_project_environment` | `POST /api/web/v1/projects/{id}/environments`; **`variables`** array (`base_url`, `username`, `password` with **`is_secret: true`** on password). Use as **fallback** if inline create did not persist env rows. |
| `testneo_bootstrap_web_mcp_project` | Validates → **`POST /api/web/v1/projects`** with optional inline default env + **`base_url`** (and optional credentials) when **`add_base_url_variable`** is true; returns **`contract_version: web_project_bootstrap.v1`**. |
| `testneo_execute_generated_test_case` | Pass **`test_case_id`** OR **`project_id` + `name_query`** (optional **`name_match_mode`**: `auto` \| `exact` \| `substring`). Optional **`environment_id`** / **`environment_name`**, **`wait_for_agent_seconds`**. With **`TESTNEO_MCP_DEFAULT_EXECUTION_MODE=local`** and **`TESTNEO_MCP_PREFER_LOCAL_AGENT`**, POST body includes **`use_agent: true`** so the API queues **AgentJob** (same routing idea as batch). Response may include **`ui_navigation`** (browser deep links; see [Execution UI deep links](#execution-ui-deep-links-ui_navigation)). |
| `testneo_run_generated_test_pipeline` | Preferred full run + report (`contract_version: execution_pipeline.v1`). Same **`test_case_id`** or **`project_id` + `name_query`** resolution and **`use_agent`** / **`wait_for_agent_seconds`** behavior as **`testneo_execute_generated_test_case`** on the initial execute step. **`pipeline.ui_navigation`** mirrors execute when an execution id is known. |
| `testneo_run_batch_by_tags` | **`POST /api/web/v1/multi-test-runs/create`** + **`…/execute`** for tests matching tags; with **`TESTNEO_MCP_DEFAULT_EXECUTION_MODE=local`** and **`TESTNEO_MCP_PREFER_LOCAL_AGENT`**, sets **`use_agent`**. Polls **`/agents/my-agent`** for up to **`TESTNEO_MCP_WAIT_FOR_AGENT_MS`** or **`wait_for_agent_seconds`** before failing when **`TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH`** is on; optional **`TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE`** opens **`setup_url`** on hard failure. Returns **`ui_navigation.multi_test_runner_url`** to open the batch in the UI. |
| `testneo_run_api_test_chain` | Same **create + execute** path as batch-by-tags, but runs tests in **chain order**: pass **`test_case_ids`** **or** **`saved_chain_id`** (exactly one). Response includes **`preserve_test_case_order: true`**, **`chain_source`**, and **`ui_navigation`** (Multi Test Runner + per-test dashboards when results exist). |
| `testneo_save_api_test_chain` | **`POST …/projects/{id}/api-test-chains`** — persist a named ordered suite from **`testneo_suggest_api_test_chains`** or manual ids. |
| `testneo_delete_saved_api_test_chain` | **`DELETE …/api-test-chains/{chain_id}`**. |
| `testneo_rerun_failed` | |
| `testneo_trigger_playwright_execution` | Raw NLP → SDK execute. |
| `testneo_set_project_route_map` | Persists `project_settings.mcp_route_hardening`. |
| `testneo_figma_image_to_tests_workflow` | **Image upload** (base64 + filename): same pipeline as UI “Upload Figma Image”; requires long timeouts for vision. |
| `testneo_swagger_upload_and_generate` | Multipart upload path for large specs. |
| `testneo_swagger_impact_analysis` | Persists spec snapshot state for diffing. |
| `testneo_swagger_impact_actions` | Bulk stale/archive/keep after triage. |
| `testneo_api_project_upload_openapi` | Classic API project OpenAPI storage. |
| `testneo_api_project_openapi_impact` | Impact vs stored or inline spec. |
| `testneo_update_test_case_nlp` | |
| `testneo_run_playwright_spec_preview` | |

**Mutating but no `confirm` flag:** `testneo_ingest_figma_context` and **`testneo_figma_to_tests_workflow`** (Figma token path) perform ETL and server-side generation without the same `confirm` gate as execute tools. **`testneo_figma_image_to_tests_workflow`** uses **`confirm=true`** like Swagger upload. Use only with intentional credentials and project scope.

Tools not listed here are read-only or compose reads (e.g. `testneo_preview_generated_tests`, `testneo_apply_route_hardening`, `testneo_swagger_preview`, `testneo_list_tests_by_tags`, `testneo_find_test_cases`, `testneo_get_local_agent_status`).

---

## Agent workflow tool (`testneo_run_agent_workflow`)

**Read-only orchestration** over existing executions: never starts new runs or calls **`testneo_rerun_failed`** by itself. Use **`testneo_run_generated_test_pipeline`** / **`testneo_execute_generated_test_case`** after you approve execution.

| `workflow_type` | Purpose |
| --- | --- |
| `qa_intelligence_workflow` | Pass/fail volume, **`latest_failed_execution_ids`**, **`triage_bundles`** (failure bundles + NLP patch hints), **`recurring_themes`**, **`rerun_plan_preview`**. |
| `triage_failure_workflow` | **`triage_bundles`** + **`recurring_themes`** for the top failed runs (no high-level **`execution_summary`** block). |
| `rerun_decision_workflow` | **`pass_rate_percent`**, failed count, **`rerun_plan_preview`** only — skips building **`triage_bundles`**. |

**Inputs:** `project_id` (required); `range`: `1d` \| `7d` \| `30d` \| `90d` (default `30d`); `top_failures` 1–5 (default 2); `rerun_limit` 1–20 (default 3).

---

## Response telemetry (`_telemetry`)

Every MCP tool invocation is wrapped with timing and backend-call tracing. On **JSON-shaped** responses, the payload includes a merged top-level **`_telemetry`** object (any prior `_telemetry` from upstream is replaced):

| Field | Meaning |
| --- | --- |
| `request_id` | Stable UUID for this tool run (support correlation). |
| `tool` | MCP tool name. |
| `duration_ms` | Wall time for the handler, milliseconds. |
| `backend_paths` | Ordered list of backend HTTP calls as **`METHOD path`** (from the MCP server’s configured API base URL). |
| `project_id` | Best-effort project dimension (derived from tool input when available). |
| `tenant_id` | Reserved tenant dimension (currently nullable unless populated by future integration). |
| `telemetry_schema_version` | Schema marker (`mcp_telemetry.v1`). |

When a tool surfaces a **`testneo_api_error`** JSON block (typically after an HTTP failure), it may include **`http_error_contract`** with **`contract_version: "testneo_mcp_http_error.v1"`** — category, **`retryable`**, and **`next_steps`** for programmatic handling (in addition to **`mcp_client_summary`** when present).

If the handler returns plain text that is **not** parseable JSON, telemetry is appended as a trailing JSON block labeled `_mcp.telemetry (JSON)`.

For centralized monitoring, set MCP env **`TESTNEO_MCP_TELEMETRY_JSONL=true`** to emit one JSON line per tool invocation to stderr (same correlation fields + `outcome` and optional `error_message`), suitable for log shippers (Vector/Fluent Bit/Loki/SigNoz pipelines).

---

## Execution-intelligence contract normalization

Execution-oriented MCP outputs now include a stable envelope for deterministic agent parsing:

- `contract_version: "execution_intelligence.v1"` on normalized execution/status tools.
- Canonical status fields:
  - `canonical_status` per execution/summary (`queued | running | passed | failed | cancelled | unknown`)
  - `raw_status` preserved for backend debugging.
- Tools aligned to this envelope include:
  - `testneo_list_recent_executions`
  - `testneo_get_execution_status`
  - `testneo_get_execution_summary`
  - `testneo_search_failures`
  - `testneo_get_pass_fail_trend` (preview rows include `canonical_status`)
  - `testneo_watch_execution` (`final_canonical_status` + timeline canonical statuses)
  - `testneo_run_generated_test_pipeline` (`pipeline.analytics_summary`, `pipeline.execution`, embedded watch timeline)

This reduces downstream prompt/parser drift when backend status strings vary (`completed`, `success`, `error`, etc.).

---

## Execution UI deep links (`ui_navigation`)

Several tools return **`ui_navigation`** with **`contract_version: "testneo_mcp_execution_ui.v1"`** so agents can open the same execution views as the TestNeo web app or VS Code extension (without guessing host/port).

| Field | Meaning |
| --- | --- |
| **`origin`** | Browser-facing SPA origin used to build dashboard URLs (often Vite **`http://localhost:5173`** in local dev). |
| **`api_origin`** | API origin used for **`api_execution_details_url`** (same host as **`TESTNEO_BASE_URL`**). |
| **`execution_dashboard_url`** | Primary human link: execution detail (steps, video when available). |
| **`executions_list_url`** | In-app runs list. |
| **`api_execution_details_url`** | JSON details path on the API host. |
| **`note`** | When analytics lags behind a local agent, the dashboard is still the best place to confirm status. |

**Tools that include `ui_navigation`:** `testneo_execute_generated_test_case` (when the execute response includes an execution id), `testneo_run_generated_test_pipeline` (nested under **`pipeline`**), `testneo_watch_execution`, `testneo_get_execution_status`, `testneo_get_execution_summary`, `testneo_get_execution_logs`, `testneo_get_failure_bundle`.

**Multi-test / API chain runs** return **`ui_navigation`** with **`contract_version: "testneo_mcp_multi_test_run_ui.v1"`** on **`testneo_run_batch_by_tags`** and **`testneo_run_api_test_chain`** (after a successful create + execute):

| Field | Meaning |
| --- | --- |
| **`multi_test_runner_url`** | Multi Test Runner in the browser (`…/test-runner?projectId=` + optional **`testRunId=`**). |
| **`project_manage_url`** | Project manage page (`…/projects/{id}/manage`). |
| **`executions_list_url`** | In-app executions list. |
| **`multi_test_status_api_url`** / **`multi_test_results_api_url`** | API poll URLs for agents. |
| **`test_execution_links`** | When results are already available: per-test **`execution_dashboard_url`** (same as single-test runs). |

**`testneo_suggest_api_test_chains`** includes **`product_navigation`** with **`project_manage_url`** and **`multi_test_runner_url`** (no `testRunId` until after a run).

**MCP env (optional, parsed in `packages/testneo-mcp-server/src/config.ts`):**

| Variable | Role |
| --- | --- |
| **`TESTNEO_WEB_APP_URL`** | SPA origin for **`execution_dashboard_url`** / **`executions_list_url`**. If unset and **`TESTNEO_BASE_URL`** is **`http://localhost:8001`** or **`http://127.0.0.1:8001`**, MCP defaults SPA links to the **same host on port 5173** (typical Vite dev). Otherwise defaults to **`TESTNEO_BASE_URL`**. |
| **`TESTNEO_WEB_APP_PATH_PREFIX`** | e.g. **`/web`** → paths like **`…/web/test-runner/execution/…`**; omit for **`…/test-runner/execution/…`** at the app root. |

**Hosted cloud:** set **`TESTNEO_WEB_APP_URL`** to the same origin as the product (e.g. **`https://app.testneo.ai`**) when you want links explicit in **`mcp.json`**; see **`docs/mcp.json.example`**.

**Scope:** MCP-only response enrichment and optional client env. **No change** to TestNeo API routes, auth, or execution semantics on the server.

---

## Failure bundle: NLP patch suggestion (`suggested_nlp_patch`)

**`testneo_get_failure_bundle`** accepts **`include_nlp_patch_suggestion`** (default **`true`**). When enabled, the server may fetch baseline NLP for the failing test case and attach **`suggested_nlp_patch`** with:

- **`unified_diff`** — line-oriented before/after for quick review.
- **`proposed_nlp_commands`** — full suggested NLP list.
- **`testneo_update_test_case_nlp`** — ready-to-call arguments when **`test_case_id`** is known; otherwise **`null`** (use **`proposed_nlp_commands`** as a template).

**`testneo_run_agent_workflow`** — for **`triage_failure_workflow`** and **`qa_intelligence_workflow`**, enriches each built failure bundle the same way. **`rerun_decision_workflow`** does not build **`triage_bundles`**.

Heuristics are conservative (route hardening, optional short wait for timeout themes); always review before applying **`testneo_update_test_case_nlp`**.

---

## Project execution preconditions (executable base URL)

**Default:** before **`testneo_generate_tests_from_context`**, **`testneo_figma_to_tests_workflow`**, and any **confirmed** execution on **`testneo_execute_generated_test_case`**, **`testneo_run_generated_test_pipeline`**, **`testneo_run_playwright_spec_preview`**, **`testneo_rerun_failed`**, **`testneo_run_batch_by_tags`**, **`testneo_run_api_test_chain`**, **`testneo_save_api_test_chain`**, **`testneo_delete_saved_api_test_chain`**, or **`testneo_trigger_playwright_execution`**, the server loads the project (and, if needed, **web environments**) and requires a resolvable **http(s)** base URL. Failures return JSON with **`error: "project_precondition_failed"`**, **`precondition_code`**, and **`remediation`** (agent-actionable).

**Web environments HTTP (used by MCP preconditions and policy):**

- **`GET /api/web/v1/projects/{project_id}/environments`** — returns an array of environments; each item includes **`variables`** (`variable_name`, `variable_value`, `is_secret`, …) so **`base_url`**, **`username`**, and **`password`** can be resolved for `{{base_url}}` and auth checks.
- **`POST /api/web/v1/projects/{project_id}/environments`** — creates an environment plus optional **`variables`**; response follows **`WebProjectEnvironmentResponse`** (includes populated **`variables`**).
- When the API supports extended **`POST /api/web/v1/projects`** bodies, **`testneo_create_web_project`** (MCP default **`create_default_environment: true`**) and **`testneo_bootstrap_web_mcp_project`** can create the **first** environment in the **same** transaction as the project; if the server ignores unknown fields, use **`testneo_create_web_project_environment`** as a second call (see guarded tools table above).

**Escape hatch (not for prod):** **`TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=true`**.

### Precondition Policies v2

Write/execute surfaces now run a policy layer and may return:
- `error: "policy_failed"`
- `policy_mode` (`strict`/`warn`)
- `findings[]` with `code`, `severity`, `message`, and `remediation`

Current policy checks include:
- executable base URL readiness
- auth credentials presence when login-like commands are detected
- route-map coverage warnings/blockers for unresolved Navigate phrases
- checkout data prerequisite warnings/blockers (checkout flow with no add-to-cart signal)
- weak assertion coverage warning (no verify/assert/expect)

Config:
- `TESTNEO_MCP_POLICY_MODE=strict` (default) or `warn`
- Batch / multi-test routing: **`TESTNEO_MCP_DEFAULT_EXECUTION_MODE`** (`local` \| `cloud`), **`TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM`**, **`TESTNEO_MCP_PREFER_LOCAL_AGENT`**, **`TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH`**, **`TESTNEO_MCP_WAIT_FOR_AGENT_MS`**, **`TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE`** — used by **`testneo_run_batch_by_tags`** and **`testneo_run_api_test_chain`** (**`use_agent`** only when execution mode is **`local`** and prefer-local is on; agent wait + optional browser open on failure).

---

## Project-scoped route map (`project_settings.mcp_route_hardening`)

- **`testneo_get_project_route_map`** reads project settings and reports both stored and effective route-hardening config.
- **`testneo_set_project_route_map`** updates `project_settings.mcp_route_hardening` (requires write enablement; use `confirm=true` to apply).
- Effective precedence during generation/update flows is:
  1. MCP env defaults (`TESTNEO_ROUTE_PROFILE`, `TESTNEO_ROUTE_MAP_JSON`)
  2. Project-scoped route map (`project_settings.mcp_route_hardening`)
  3. Per-call `route_hardening` override

This keeps a team-level source of truth without relying on each developer machine env.

---

## Idempotency for write tools

Write tools accept optional `idempotency_key` (string). Behavior:
- Same key + same effective input => replay cached response (`replayed: true`)
- Same key + different effective input => `error: "idempotency_conflict"`
- No key => normal behavior (no replay protection)

Recommended for retries from CI agents and orchestrated prompts.

---

## Example Inputs

### `testneo_get_failure_bundle`
```json
{
  "execution_id": "abc123def456",
  "logs_limit": 150,
  "event_limit": 20,
  "include_nlp_patch_suggestion": true
}
```

### `testneo_get_pass_fail_trend`
```json
{
  "project_id": 47,
  "range": "30d",
  "limit": 200
}
```

### `testneo_run_agent_workflow`
```json
{
  "workflow_type": "qa_intelligence_workflow",
  "project_id": 47,
  "range": "30d",
  "top_failures": 2,
  "rerun_limit": 3
}
```

### `testneo_ai_assistant_query`

**With unified context (same as selecting context in `/web/ai-assistant`):**

```json
{
  "project_id": 47,
  "context_name_query": "figma checkout",
  "query": "What interactive elements on this screen should we prioritize for automated UI tests?",
  "response_style": "detailed"
}
```

**Project-wide (no context — analytics-style questions):**

```json
{
  "project_id": 47,
  "query": "Give me an executive summary of test health for this project.",
  "response_style": "concise"
}
```

### `testneo_generate_tests_from_context`

Do **not** scrape numeric ids from the UI when you have a label: call **`testneo_get_unified_context_by_name`** with **`name_query`** (e.g. `"figma checkout"` for a context named like **`Figma — Checkout flow`**), then pass its **`resolved_context_id`** as the **`context_id`** field below. The sample value **`203`** is illustrative only.

**Generic sites (no SauceDemo login):** omit **`auth_preamble`** entirely — the server does **not** inject `standard_user` / `secret_sauce` lines and does **not** auto-apply the SauceDemo phrase map unless you explicitly pass **`auth_preamble`** with **`preset: "saucedemo"`**. Environment username/password policy for generation is relaxed when SauceDemo is not requested.

**SauceDemo demos only:**

```json
{
  "project_id": 47,
  "context_id": 203,
  "auth_preamble": {
    "enabled": true,
    "preset": "saucedemo"
  },
  "persist_auth_preamble": true,
  "persist_route_hardening": true,
  "auto_align_saucedemo_route_map": true
}
```

**Public or custom-login app (omit `auth_preamble`):**

```json
{
  "project_id": 47,
  "context_id": 203,
  "auto_align_saucedemo_route_map": false
}
```

With **`auto_align_saucedemo_route_map`** **`true`** **and** explicit SauceDemo **`auth_preamble`**, MCP applies the SauceDemo phrase map when env has **`TESTNEO_ROUTE_PROFILE=none`** and no **`TESTNEO_ROUTE_MAP_JSON`**. For other apps, set **`auto_align_saucedemo_route_map: false`** or supply **`TESTNEO_ROUTE_MAP_JSON`** / **`testneo_set_project_route_map`** for Navigate phrase → path. See [Non–Sauce Demo sites](./MCP_NON_SAUCE_DEMO_TESTING.md).

### `testneo_list_unified_contexts`
```json
{
  "project_id": 47,
  "compact": true,
  "max_compact_lines": 60
}
```

### `testneo_get_unified_context_by_name`

Matches names like **`Figma — Checkout flow`** when you query `"figma checkout"`. Use **`prefer_context_id`** only if several rows tie.

```json
{
  "project_id": 47,
  "name_query": "figma checkout",
  "match_mode": "auto",
  "prefer_context_id": 203,
  "include_detail": false
}
```

### `testneo_run_generated_test_pipeline`

```json
{
  "test_case_id": 7708,
  "confirm": true,
  "environment_name": "uat",
  "idempotency_key": "run-7708-2026-05-10",
  "wait_for_agent_seconds": 90
}
```

### `testneo_execute_generated_test_case`
```json
{
  "test_case_id": 7708,
  "confirm": true,
  "wait_for_agent_seconds": 60
}
```

---

## Website and npm package sync

| Audience | File to use |
|----------|-------------|
| **Hosted docs (testneo.ai)** | **Release Intelligence:** publish from **`docs/product/RELEASE_INTELLIGENCE_WEBSITE_CONTENT.md`** + **`docs/product/ENGINEERING_MEMORY_CUSTOMER_GUIDE.md`** → [release-intelligence.html](https://testneo.ai/docs/release-intelligence.html). **MCP tools:** publish from **`docs/mcp/mcp-tool-reference.md`** (this file) → [testneo-mcp.html](https://testneo.ai/docs/testneo-mcp.html). |
| **npm package `@testneo/mcp-server`** | Before release, copy this file to **`packages/testneo-mcp-server/docs/MCP_TOOL_REFERENCE.md`** (see `packages/testneo-mcp-server/scripts/sync-public-mcp-repo.sh` or `scripts/push-public-mirror-local.sh` in that package). |
| **GitHub mirror** | Same content as the package doc; CI in `.github/workflows/sync-mcp-public-mirror.yml` watches **`docs/mcp/mcp-tool-reference.md`**. |

Keeping **one** source of truth per page avoids drift between the website, npm README, and MCP server bundle.

