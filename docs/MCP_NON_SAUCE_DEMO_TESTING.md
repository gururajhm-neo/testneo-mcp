# MCP: testing non–Sauce Demo sites

SauceLabs’ **Sauce Demo** ([saucedemo.com](https://www.saucedemo.com)) is only a **reference app**. For your own product, public playgrounds, or internal staging, you should **not** send SauceDemo credentials or rely on SauceDemo route phrases.

## What the MCP server does now

| Situation | Behavior |
|-----------|----------|
| **`testneo_generate_tests_from_context` without `auth_preamble`** | No SauceDemo login lines injected. No automatic switch to the SauceDemo phrase → path map for route hardening. Project env **username/password** is **not** required for that tool’s precondition check unless the generated NLP later implies login. |
| **Explicit `auth_preamble` with `preset: "saucedemo"`** | Injects standard SauceDemo login NLP (when enabled) and allows **`auto_align_saucedemo_route_map`** to apply bundled checkout/cart phrases. Use only when the **target under test** is actually Sauce Demo. |
| **`preset: "custom"`** | Use **`commands`** for your own preamble lines, or leave empty for no preamble. |

## Configure the app under test

1. In TestNeo, set the project **website URL** and/or **environment** **`base_url`** to your real origin (e.g. `https://nearform.github.io/testing-playground/` or a path under it, per how you run tests).
2. Use **`{{base_url}}`** / env variables in NLP steps so you are not hardcoding hosts in every command.
3. If the model emits vague **Navigate to …** phrases, add **`TESTNEO_ROUTE_MAP_JSON`** or **`testneo_get_project_route_map` / `testneo_set_project_route_map`** so those phrases map to real paths.

## Example: generate from context (generic site)

Use **`name_query`** → **`resolved_context_id`** (see [unified context discovery](https://testneo.ai/docs/testneo-mcp.html)). Omit **`auth_preamble`**. Optionally set **`auto_align_saucedemo_route_map: false`** in the tool args for clarity:

```json
{
  "project_id": "<PROJECT_ID>",
  "context_id": "<RESOLVED_CONTEXT_ID>",
  "auto_align_saucedemo_route_map": false
}
```

## Sanity checklist

1. **`testneo_validate_connection`**
2. **`testneo_list_projects`**
3. Confirm project executable base URL resolves (no `example.com` placeholder).
4. **`testneo_generate_tests_from_context`** with **no** `auth_preamble` (or `auth_preamble: { enabled: false }` if you need to persist explicitly without login lines).
5. **`testneo_preview_generated_tests`** on the returned cases; fix vague navigations with **`testneo_update_test_case_nlp`** or route map.
6. **`testneo_run_generated_test_pipeline`** with **`confirm: true`** once writes are enabled — or execute a single case.

## Nearform Testing Playground

**https://nearform.github.io/testing-playground/** is a third-party static demo; there is no Swagger bundled in this MCP for that URL. Typical paths:

- **Unified context** built in the TestNeo UI or via ingest, with scope covering that site, **or**
- **Swagger / OpenAPI** for a **different** service, if your goal is API-only tests.

Point the project environment at the playground **base URL**, omit **`auth_preamble`**, generate or author tests, then run the **pipeline** tool for a single case to verify end-to-end.
