# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **API test chains (Multi Test Runner parity):** **`testneo_suggest_api_test_chains`**, **`testneo_list_saved_api_test_chains`** (read); **`testneo_save_api_test_chain`**, **`testneo_delete_saved_api_test_chain`**, **`testneo_run_api_test_chain`** (guarded writes; ordered **`test_case_ids`** or **`saved_chain_id`**). Shared multi-test execute core with **`testneo_run_batch_by_tags`** (`preserve_test_case_order`).
- **`ui_navigation`** (`testneo_mcp_multi_test_run_ui.v1`) on **`testneo_run_batch_by_tags`** / **`testneo_run_api_test_chain`**: **`multi_test_runner_url`**, **`project_manage_url`**, optional **`test_execution_links`**. Frontend: **`testRunId`** query on **`/web/test-runner`** opens batch results.
- **`testneo_ai_assistant_query`:** **`POST /api/web/v1/etl/ai-assistant/query`** — same Web AI Assistant as **`/web/ai-assistant`**: `project_id` + natural-language `query`, optional **`context_id`** or **`context_name_query`**, **`response_style`** (`concise` \| `detailed`), optional **`recommend_context`** / **`rag_context`**. Returns **`assistant_reply`**, **`product_navigation.web_ai_assistant_url`**, and full **`upstream`** (uses Web AI chat quota).
- **`ui_navigation`** (`contract_version: "testneo_mcp_execution_ui.v1"`) on execution-related tools: **`execution_dashboard_url`**, **`executions_list_url`**, **`api_execution_details_url`**, **`api_origin`** (API host) vs **`origin`** (SPA host); also **`testneo_get_failure_bundle`** and **`testneo_get_execution_logs`**. **`TESTNEO_WEB_APP_URL`** / **`TESTNEO_WEB_APP_PATH_PREFIX`** override SPA links; when **`TESTNEO_BASE_URL`** is local **`…:8001`** and **`TESTNEO_WEB_APP_URL`** is unset, SPA links default to **`…:5173`** (Vite). **`/web/test-runner/execution/:id`** routes in the monorepo frontend match **`TESTNEO_WEB_APP_PATH_PREFIX=/web`**.
- **`testneo_find_test_cases`:** read-only **`GET /api/web/v1/test-cases/?search=`** + **`project_id`** — browse **`id` / `name` / `tags`** before execute.
- **`testneo_execute_generated_test_case`** / **`testneo_run_generated_test_pipeline`:** run by **`test_case_id`** **or** **`project_id` + `name_query`** (optional **`name_match_mode`**: `auto` \| `exact` \| `substring`); responses include **`name_resolution`** when resolved from name.
- **`apiErrorHints`:** MCP tool failures on HTTP **403/429** prepend a short **`### TestNeo API blocked…`** summary (subscription, limits, trial) plus `mcp_client_summary` in JSON for Cursor.
- `scripts/api-error-hints-check.mjs` (runs in **`npm test`** after build).
- Public mirror sync script: `scripts/sync-public-mcp-repo.sh`.
- `SECURITY.md`, `CHANGELOG.md`, and GPLv3 `LICENSE` in-package.
- Bundled `docs/MCP_TOOL_REFERENCE.md` (mirrors the main TestNeo API repo’s `docs/mcp/mcp-tool-reference.md` for self-contained publishing).
- **`.npmrc`** (`audit=false`, `fund=false`, `progress=false`) — fewer install stalls / prompts.
- **`docs/MCP_NON_SAUCE_DEMO_TESTING.md`** and monorepo **`docs/mcp/mcp-non-saucedemo-testing.md`**; README troubleshooting for slow install.

### Changed
- Mirror sync: monorepo **`docs/mcp/mcp-ai-assistant-and-prompts.md`** (publishable Web AI Assistant MCP guide + prompt/persona library); copy into this package’s `docs/` when publishing bundled docs.
- **`docs/MCP_TOOL_REFERENCE.md`** (synced from monorepo **`docs/mcp/mcp-tool-reference.md`**): guarded-tools notes for **`testneo_create_web_project`** / **`testneo_bootstrap_web_mcp_project`** (inline env + Lighthouse when API supports), **`GET/POST …/environments`** + **`variables`** for preconditions, **Website and npm package sync** footer.
- **`package.json`:** replaced **`prepare`** (clean + build on every `npm install`) with **`prepublishOnly`** so local/CI installs no longer spawn a heavy compile by default (`npm publish` still builds).
- **`testneo_generate_tests_from_context`:** omitting **`auth_preamble`** no longer implies Sauce Demo (no login injection; no Sauce phrase-map auto-align; env credential check optional unless explicit `preset: "saucedemo"`).
- `testneo_execute_generated_test_case` / `testneo_run_generated_test_pipeline`: optional `environment_id` / `environment_name` for execution requests.
- `testneo_run_generated_test_pipeline`: project trend fallback when execution payloads omit `project_id`.
- Mirror scripts: usage text uses concrete example path `$HOME/Documents/testneo-mcp` instead of generic `/path/to/...` placeholders.
- README: onboarding for TestNeo Cloud (`https://app.testneo.ai`), links to [testneo.ai](https://testneo.ai) and [hosted MCP docs](https://testneo.ai/docs/testneo-mcp.html); production smoke example; maintainer mirror notes moved to end + `docs/PUBLISHING.md`.
- `.env.example`: default `TESTNEO_BASE_URL` to production; comment for self-hosted.

## [0.1.0] - 2025-2026

Initial published MCP surface: TestNeo quality, execution intelligence, Swagger/OpenAPI tools, Figma/context generation, guarded writes.
