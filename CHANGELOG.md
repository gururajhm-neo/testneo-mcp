# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Public mirror sync script: `scripts/sync-public-mcp-repo.sh`.
- `SECURITY.md`, `CHANGELOG.md`, and GPLv3 `LICENSE` in-package.
- Bundled `docs/MCP_TOOL_REFERENCE.md` (mirrors the main TestNeo API repo’s `docs/mcp-tool-reference.md` for self-contained publishing).

### Changed
- `testneo_execute_generated_test_case` / `testneo_run_generated_test_pipeline`: optional `environment_id` / `environment_name` for execution requests.
- `testneo_run_generated_test_pipeline`: project trend fallback when execution payloads omit `project_id`.
- Mirror scripts: usage text uses concrete example path `$HOME/Documents/testneo-mcp` instead of generic `/path/to/...` placeholders.

## [0.1.0] - 2025-2026

Initial published MCP surface: TestNeo quality, execution intelligence, Swagger/OpenAPI tools, Figma/context generation, guarded writes.
