# @testneo/mcp-server

**TestNeo MCP** connects Cursor, VS Code, Claude Desktop, and other [MCP](https://modelcontextprotocol.io)-compatible clients to [**TestNeo**](https://testneo.ai) — so your AI chat can list projects, inspect runs, generate tests from context (including Swagger/OpenAPI and design context), and (when you allow it) execute tests with guardrails.

| Resource | Link |
|----------|------|
| **Product** | [testneo.ai](https://testneo.ai) |
| **Sign up & app** | [app.testneo.ai/signup](https://app.testneo.ai/signup) |
| **Hosted MCP docs** (quickstart, tools, workflows, security) | [testneo.ai/docs/testneo-mcp.html](https://testneo.ai/docs/testneo-mcp.html) |
| **Source** | [github.com/gururajhm-neo/testneo-mcp](https://github.com/gururajhm-neo/testneo-mcp) |

---

## Get started (production)

### 1) Create a TestNeo account and project

1. Open **[app.testneo.ai/signup](https://app.testneo.ai/signup)** and register.
2. In the app, **create a project** (web/API automation) and note the **project id** when you run workflows from chat.
3. Open your account/API settings and **create an API key** (`tn_…`). Treat it like a password.

### 2) Point the MCP server at TestNeo Cloud

Use the **production API base URL**:

| Variable | Value |
|----------|--------|
| `TESTNEO_BASE_URL` | **`https://app.testneo.ai`** |
| `TESTNEO_API_KEY` | your `tn_…` key |

Self-hosted customers can set `TESTNEO_BASE_URL` to their own API origin instead.

### 3) Add the server to your IDE (recommended: `npx`)

No global install required. Example for **Cursor** (`~/.cursor/mcp.json` or **Settings → MCP**):

```json
{
  "mcpServers": {
    "testneo": {
      "command": "npx",
      "args": ["-y", "@testneo/mcp-server"],
      "env": {
        "TESTNEO_BASE_URL": "https://app.testneo.ai",
        "TESTNEO_API_KEY": "tn_YOUR_KEY_HERE",
        "TESTNEO_MCP_ALLOW_WRITE": "false"
      }
    }
  }
}
```

Keep **`TESTNEO_MCP_ALLOW_WRITE`** at **`false`** until you intentionally want execute/rerun/Swagger-write tools; read-only tools still work. Write tools also need **`confirm=true`** on each call — see [hosted security section](https://testneo.ai/docs/testneo-mcp.html).

### 4) Reload MCP and verify

Restart the IDE (or reload MCP servers), then in chat:

```text
Validate my TestNeo connection
```

```text
List my TestNeo projects
```

### 5) Go deeper

Follow **[TestNeo MCP — Docs](https://testneo.ai/docs/testneo-mcp.html)** for quickstart detail, **tool reference**, **workflows** (e.g. `qa_intelligence_workflow`), and **troubleshooting**. This repo’s **`docs/MCP_TOOL_REFERENCE.md`** mirrors the same tool list for offline browsing.

---

## Why use TestNeo MCP?

- **Less context switching** — quality signals, generation, and execution requests happen in the same chat as your code.
- **Guarded writes** — mutating tools stay off unless you set `TESTNEO_MCP_ALLOW_WRITE=true` and pass `confirm=true`.
- **Same backend as the product** — projects, executions, Swagger pipeline, Figma/context flows, and Playwright SDK paths all go through your real TestNeo deployment.

---

## Smoke check (against your account)

From a clone of this repo, after `npm install` and `npm run build`:

```bash
TESTNEO_BASE_URL="https://app.testneo.ai" TESTNEO_API_KEY="tn_YOUR_KEY_HERE" npm run smoke
```

Copy **`.env.example`** to `.env` and edit values if you prefer loading env from a file (your shell or tooling must export them before `npm run smoke`).

---

## Optional: run from a local build instead of `npx`

```bash
npm install
npm run build
```

Point your MCP config at:

```bash
node /absolute/path/to/this/repo/dist/index.js
```

See **`docs/IDE_SETUP.md`** for more client-specific notes.

---

## Responses & contracts

- Tool responses include **`_telemetry`** (`request_id`, `duration_ms`, `backend_paths`, etc.) for support and auditing.
- **`testneo_get_failure_bundle`** (and triage-heavy **`testneo_run_agent_workflow`** steps) may include **`suggested_nlp_patch`** when **`include_nlp_patch_suggestion`** is true (default). Details: **`docs/MCP_TOOL_REFERENCE.md`**.
- **Project execution preconditions (default on):** generate/execute-style tools may return **`project_precondition_failed`** unless the project resolves a real **https** base URL for the app under test (`website_url` or environment `base_url`). **`example.com`** placeholders are rejected. For special dev setups only: **`TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=true`**.
- **Execution intelligence:** normalized payloads use **`contract_version: execution_intelligence.v1`** (or pipeline variants) and **`canonical_status`** (`queued` \| `running` \| `passed` \| `failed` \| `cancelled` \| `unknown`) alongside raw backend status.

---

## v1 tool surface (summary)

Read-heavy: connection, projects, executions, logs, trends, watch, failure bundles, agent workflows, unified contexts, Swagger preview, route map, etc.

Writes (guarded): execute generated test, **`testneo_run_generated_test_pipeline`** (run + wait + report), rerun failed, trigger Playwright, Swagger upload/impact, NLP updates, route map persist, Figma ingest, etc.

Full list: **`docs/MCP_TOOL_REFERENCE.md`** or [hosted tool reference](https://testneo.ai/docs/testneo-mcp.html).

---

## Environment reference

**Required**

- `TESTNEO_BASE_URL` — use **`https://app.testneo.ai`** for TestNeo Cloud; otherwise your self-hosted API origin.
- `TESTNEO_API_KEY` — from the app after signup.

**Common optional flags**

- `TESTNEO_MCP_ALLOW_WRITE` — default `false`; set `true` only when you want mutating tools.
- `TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS` — default `false`.
- `TESTNEO_MCP_TELEMETRY_JSONL`, `TESTNEO_MCP_POLICY_MODE`, `TESTNEO_MCP_TIMEOUT_MS`, `TESTNEO_MCP_SWAGGER_TIMEOUT_MS`, `TESTNEO_MCP_USER_AGENT`
- Route hardening: `TESTNEO_ROUTE_HARDENING`, `TESTNEO_ROUTE_PROFILE`, `TESTNEO_ROUTE_MAP_JSON`

**Context generation:** For **SauceDemo.com** demos only, pass **`auth_preamble: { enabled: true, preset: "saucedemo" }`** so login lines and optional route phrase alignment apply. For **any other site** (e.g. public demos, your own app), **omit `auth_preamble`** — no SauceDemo login is injected and env username/password checks are not forced for that call. Use **`TESTNEO_ROUTE_MAP_JSON`** or **`testneo_set_project_route_map`** when Navigate steps need phrase → path hints.

**More detail:** **`docs/MCP_NON_SAUCE_DEMO_TESTING.md`** (in this repo / npm package docs folder). Canonical copy in the monorepo: `docs/mcp-non-saucedemo-testing.md`.

---

## Tests (no live API)

```bash
npm install
npm test
```

`npm test` runs a **`pretest`** build, then offline guardrail scripts (no `TESTNEO_API_KEY` required).

### If `npm install` feels stuck or slow

Older versions of this repo used a **`prepare`** hook that ran a full rebuild on **every** install; that hook is **removed**. If install still hangs, try:

```bash
cd packages/testneo-mcp-server
npm install --no-audit --no-fund --ignore-scripts
npm run build
npm test
```

This package includes **`.npmrc`** (`audit=false`, `fund=false`, `progress=false`) so installs are less chatty.

---

## Security

- API key is read **only** from the environment.
- Write tools are **disabled** unless `TESTNEO_MCP_ALLOW_WRITE=true`.
- Write tools require **`confirm=true`** (and optional **`idempotency_key`** for safe retries).

More policy detail: [Security & Governance](https://testneo.ai/docs/testneo-mcp.html) on the hosted docs.

---

## License & reporting

- **License:** GPL-3.0 — see **`LICENSE`**.
- **Security:** see **`SECURITY.md`**.
- **Changelog:** **`CHANGELOG.md`**.

---

## Maintainers only: public GitHub mirror

The npm package and **[gururajhm-neo/testneo-mcp](https://github.com/gururajhm-neo/testneo-mcp)** mirror are synced from the private TestNeo monorepo. **Do not put monorepo paths or internal CI tokens in your MCP client config** — that is maintainer workflow only.

Instructions (local push, optional GitHub Actions secret): **`docs/PUBLISHING.md`**.
