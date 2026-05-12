# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`apiErrorHints`:** MCP tool failures on HTTP **403/429** prepend a short **`### TestNeo API blocked…`** summary (subscription, limits, trial) plus `mcp_client_summary` in JSON for Cursor.
- `scripts/api-error-hints-check.mjs` (runs in **`npm test`** after build).
- Public mirror sync script: `scripts/sync-public-mcp-repo.sh`.
- `SECURITY.md`, `CHANGELOG.md`, and GPLv3 `LICENSE` in-package.
- Bundled `docs/MCP_TOOL_REFERENCE.md` (mirrors the main TestNeo API repo’s `docs/mcp-tool-reference.md` for self-contained publishing).
- **`.npmrc`** (`audit=false`, `fund=false`, `progress=false`) — fewer install stalls / prompts.
- **`docs/MCP_NON_SAUCE_DEMO_TESTING.md`** and monorepo **`docs/mcp-non-saucedemo-testing.md`**; README troubleshooting for slow install.

### Changed
- **`docs/MCP_TOOL_REFERENCE.md`** (synced from monorepo **`docs/mcp-tool-reference.md`**): guarded-tools notes for **`testneo_create_web_project`** / **`testneo_bootstrap_web_mcp_project`** (inline env + Lighthouse when API supports), **`GET/POST …/environments`** + **`variables`** for preconditions, **Website and npm package sync** footer.
- **`package.json`:** replaced **`prepare`** (clean + build on every `npm install`) with **`prepublishOnly`** so local/CI installs no longer spawn a heavy compile by default (`npm publish` still builds).
- **`testneo_generate_tests_from_context`:** omitting **`auth_preamble`** no longer implies Sauce Demo (no login injection; no Sauce phrase-map auto-align; env credential check optional unless explicit `preset: "saucedemo"`).
- `testneo_execute_generated_test_case` / `testneo_run_generated_test_pipeline`: optional `environment_id` / `environment_name` for execution requests.
- `testneo_run_generated_test_pipeline`: project trend fallback when execution payloads omit `project_id`.
- Mirror scripts: usage text uses concrete example path `$HOME/Documents/testneo-mcp` instead of generic `/path/to/...` placeholders.
- README: onboarding for TestNeo Cloud (`https://app.testneo.ai`), links to [testneo.ai](https://testneo.ai) and [hosted MCP docs](https://testneo.ai/docs/testneo-mcp.html); production smoke example; maintainer mirror notes moved to end + `docs/PUBLISHING.md`.
- `.env.example`: default `TESTNEO_BASE_URL` to production; comment for self-hosted.

## [0.1.0] - 2025-2026

Initial published MCP surface: TestNeo quality, execution intelligence, Swagger/OpenAPI tools, Figma/context generation, guarded writes.
