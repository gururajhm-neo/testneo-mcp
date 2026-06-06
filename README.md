# @testneo/mcp-server

**TestNeo MCP** connects Cursor, VS Code, Claude Desktop, and other [MCP](https://modelcontextprotocol.io)-compatible clients to [**TestNeo**](https://testneo.ai) — so your AI chat can list projects, inspect runs, generate tests from context (including Swagger/OpenAPI and design context), and (when you allow it) execute tests with guardrails. **Differentiation:** the **VS Code extension** fits **in-editor** right‑click generate → tweak → run; **MCP** fits **chat- and agent-driven** TestNeo workflows from Cursor and other MCP clients — see [VS Code extension or MCP?](../../docs/mcp/mcp-quickstart.md#vs-code-extension-or-testneo-mcp) in the monorepo quickstart.

| Resource | Link |
|----------|------|
| **Product** | [testneo.ai](https://testneo.ai) |
| **Sign up & app** | [app.testneo.ai/signup](https://app.testneo.ai/signup) |
| **Hosted MCP docs** (quickstart, tools, workflows, security) | [testneo.ai/docs/testneo-mcp.html](https://testneo.ai/docs/testneo-mcp.html) |
| **Release Intelligence** (Memory, patterns, outcomes) | [testneo.ai/docs/release-intelligence.html](https://testneo.ai/docs/release-intelligence.html) · [Customer guide](../../docs/product/ENGINEERING_MEMORY_CUSTOMER_GUIDE.md) |
| **Source** | [github.com/gururajhm-neo/testneo-mcp](https://github.com/gururajhm-neo/testneo-mcp) |

---

## Get started

### 1) Create a TestNeo account and project

1. Open **[app.testneo.ai/signup](https://app.testneo.ai/signup)** and register (or use your self-hosted deployment).
2. **Recommended:** validate **locally** first — run this monorepo’s API, set **`TESTNEO_BASE_URL`** to that origin (e.g. `http://127.0.0.1:8000`), and point MCP at **`packages/testneo-mcp-server/dist/index.js`** after `npm run build` so **project + environment + credentials** match what you will ship to prod.
3. Note the **project id** when you run workflows from chat. You can create the web project from MCP (**`testneo_bootstrap_web_mcp_project`** or **`testneo_create_web_project`**) when **`TESTNEO_MCP_ALLOW_WRITE=true`** — full flow (inline env, credentials, API compatibility, Lighthouse): [MCP quickstart](../../docs/mcp/mcp-quickstart.md) **section 4** (from the **testneo-api** monorepo root).
4. Open account/API settings and **create an API key** (`tn_…`). Treat it like a password.

### 2) Point the MCP server at your API

| Variable | Value |
|----------|--------|
| `TESTNEO_BASE_URL` | **TestNeo Cloud:** **`https://app.testneo.ai`**. **Local / self-hosted:** origin that serves **`/api/web/v1`** (e.g. `http://127.0.0.1:8001`). |
| `TESTNEO_WEB_APP_URL` | **Optional.** Browser origin for execution dashboard links in MCP (e.g. Vite **`http://localhost:5173`**). Defaults to **`TESTNEO_BASE_URL`**, or **`…:5173`** when the base URL is **`localhost`/`127.0.0.1` on port 8001**. |
| `TESTNEO_WEB_APP_PATH_PREFIX` | **Optional.** e.g. **`/web`** so links look like **`…/web/test-runner/execution/…`** (matches monorepo routes). Omit for **`…/test-runner/execution/…`** at the app root. |
| `TESTNEO_API_KEY` | your `tn_…` key |

**Defaults & optional knobs:** if you omit optional `TESTNEO_MCP_*` variables, the server uses safe built-in defaults (e.g. read-only **`TESTNEO_MCP_ALLOW_WRITE`**, standard timeouts). **`TESTNEO_BASE_URL`** defaults to **`http://localhost:8001`** when unset—wrong for cloud, so always set it for **`app.testneo.ai`**. Full table, **client vs API** (no MCP vars on AWS `app/.env` for normal usage), and **how to override** via `mcp.json` / shell: [monorepo MCP quickstart](../../docs/mcp/mcp-quickstart.md#where-mcp-env-lives-client-vs-api) (see also the [environment variable table](../../docs/mcp/mcp-quickstart.md#mcp-environment-variables-required-optional-defaults)).

Use **`127.0.0.1`** instead of `localhost` if Cursor or `npx` hits proxy issues ([monorepo troubleshooting](../../docs/mcp/mcp-troubleshooting.md)).

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
        "TESTNEO_WEB_APP_URL": "https://app.testneo.ai",
        "TESTNEO_API_KEY": "tn_YOUR_KEY_HERE",
        "TESTNEO_MCP_ALLOW_WRITE": "false",
        "TESTNEO_MCP_TELEMETRY_JSONL": "true",
        "TESTNEO_MCP_DEFAULT_EXECUTION_MODE": "local",
        "TESTNEO_MCP_PREFER_LOCAL_AGENT": "true",
        "TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM": "local",
        "TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH": "true",
        "TESTNEO_MCP_WAIT_FOR_AGENT_MS": "60000"
      }
    }
  }
}
```

Keep **`TESTNEO_MCP_ALLOW_WRITE`** at **`false`** until you intentionally want execute/rerun/Swagger-write tools; read-only tools still work. Write tools also need **`confirm=true`** on each call — see [hosted security section](https://testneo.ai/docs/testneo-mcp.html).

### Guardrails (quick reference)

| Knob | Role |
|------|------|
| **`TESTNEO_MCP_ALLOW_WRITE`** | MCP env: **`false`** = read-only tools only; **`true`** = mutating tools may call the API. Restart MCP after changing. |
| **`confirm`** | Per guarded tool: **`false`** = preview/dry; **`true`** = perform (execute, pipeline, bootstrap create, etc.). Needs allow-write where applicable. |
| **`idempotency_key`** | Optional (**≥ 8** chars when set): dedupes retries so the same logical action is not applied twice. |
| **`environment_name` / `environment_id`** | On execution tools: which **project environment** supplies `{{base_url}}` and credentials (must match TestNeo UI). |

**Guardrails (full table + install):** when developing inside **testneo-api**, see [docs/mcp/mcp-quickstart.md](../../docs/mcp/mcp-quickstart.md) (includes **NLP API from Swagger**, section 7) and [customer E2E playbook](../../docs/mcp/mcp-customer-e2e-playbook.md#part-f-swagger-api-nlp-flow). For the **standalone npm/GitHub** package only, use [TestNeo MCP docs](https://testneo.ai/docs/testneo-mcp.html) (same content when published).

### 4) Reload MCP and verify

Restart the IDE (or reload MCP servers), then in chat:

```text
Validate my TestNeo connection
```

```text
List my TestNeo projects
```

### 5) Go deeper

Follow **[TestNeo MCP — Docs](https://testneo.ai/docs/testneo-mcp.html)** for quickstart detail, **tool reference**, **workflows** (e.g. `qa_intelligence_workflow`), and **troubleshooting**. In the **testneo-api** monorepo, the canonical Markdown is **`docs/mcp/mcp-tool-reference.md`** (mirrored into this package as **`docs/MCP_TOOL_REFERENCE.md`** before publish). **Web AI Assistant from MCP** (prompts & personas): monorepo **`docs/mcp/mcp-ai-assistant-and-prompts.md`** → package **`docs/MCP_AI_ASSISTANT_AND_PROMPTS.md`**.

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
- **`testneo_get_failure_bundle`** (and triage-heavy **`testneo_run_agent_workflow`** steps) may include **`suggested_nlp_patch`** when **`include_nlp_patch_suggestion`** is true (default). Details: **[`docs/MCP_TOOL_REFERENCE.md`](./docs/MCP_TOOL_REFERENCE.md)** (same content as monorepo **`docs/mcp/mcp-tool-reference.md`**).
- **Project execution preconditions (default on):** generate/execute-style tools may return **`project_precondition_failed`** unless the project resolves a real **https** base URL for the app under test (`website_url` or environment `base_url`). **`example.com`** placeholders are rejected. For special dev setups only: **`TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=true`**.
- **Execution intelligence:** normalized payloads use **`contract_version: execution_intelligence.v1`** (or pipeline variants) and **`canonical_status`** (`queued` \| `running` \| `passed` \| `failed` \| `cancelled` \| `unknown`) alongside raw backend status.

---

## v1 tool surface (summary)

Read-heavy: connection, projects, executions, logs, trends, watch, failure bundles, agent workflows, unified contexts, Swagger preview, route map, etc.

Writes (guarded): execute generated test, **`testneo_run_generated_test_pipeline`** (run + wait + report), **`testneo_run_batch_by_tags`** (multi-test by tags), **`testneo_run_api_test_chain`** (multi-test in saved or suggested **chain order**), **`testneo_save_api_test_chain`** / **`testneo_delete_saved_api_test_chain`**, rerun failed, trigger Playwright, Swagger upload/impact, NLP updates, route map persist, Figma ingest, etc.

Reads for NLP API suites: **`testneo_suggest_api_test_chains`**, **`testneo_list_saved_api_test_chains`** (see docs).

Full list: **[`docs/MCP_TOOL_REFERENCE.md`](./docs/MCP_TOOL_REFERENCE.md)** (synced from monorepo **`docs/mcp/mcp-tool-reference.md`**) or [hosted tool reference](https://testneo.ai/docs/testneo-mcp.html).

---

## Environment reference

**Required**

- `TESTNEO_BASE_URL` — use **`https://app.testneo.ai`** for TestNeo Cloud; otherwise your self-hosted API origin.
- `TESTNEO_API_KEY` — from the app after signup.

**Common optional flags**

- **Execution routing (confused? start here):** In the monorepo, open **[`docs/mcp/mcp-quickstart.md`](../../docs/mcp/mcp-quickstart.md)** → **§1 Option A** — the example **`mcp.json`** includes the full `env` block. **Agent-first:** `TESTNEO_MCP_DEFAULT_EXECUTION_MODE=local` + `TESTNEO_MCP_PREFER_LOCAL_AGENT=true`. **Not agent-first:** the doc shows the alternate five lines to paste instead. Restart MCP after changes.
- `TESTNEO_MCP_ALLOW_WRITE` — default `false`; set `true` only when you want mutating tools.
- `TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS` — default `false`.
- `TESTNEO_MCP_TELEMETRY_JSONL`, `TESTNEO_MCP_POLICY_MODE`, `TESTNEO_MCP_TIMEOUT_MS`, `TESTNEO_MCP_SWAGGER_TIMEOUT_MS`, `TESTNEO_MCP_USER_AGENT`
- Batch / local agent defaults (for **`testneo_run_batch_by_tags`**): `TESTNEO_MCP_DEFAULT_EXECUTION_MODE`, `TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM`, `TESTNEO_MCP_PREFER_LOCAL_AGENT`, `TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH`, `TESTNEO_MCP_WAIT_FOR_AGENT_MS`, `TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE`
- Route hardening: `TESTNEO_ROUTE_HARDENING`, `TESTNEO_ROUTE_PROFILE`, `TESTNEO_ROUTE_MAP_JSON`

**Context generation:** For **SauceDemo.com** demos only, pass **`auth_preamble: { enabled: true, preset: "saucedemo" }`** so login lines and optional route phrase alignment apply. For **any other site** (e.g. public demos, your own app), **omit `auth_preamble`** — no SauceDemo login is injected and env username/password checks are not forced for that call. Use **`TESTNEO_ROUTE_MAP_JSON`** or **`testneo_set_project_route_map`** when Navigate steps need phrase → path hints.

**More detail:** **`docs/MCP_NON_SAUCE_DEMO_TESTING.md`** (in this repo / npm package docs folder). Canonical copy in the monorepo: `docs/mcp/mcp-non-saucedemo-testing.md`.

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
