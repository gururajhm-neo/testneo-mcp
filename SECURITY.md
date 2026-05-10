# Security policy

## Supported versions

| Version | Supported |
|--------|-----------|
| `0.1.x` (current) | Yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security problems.

- Email: **contact@testneo.ai** (or your org’s security inbox if this fork is under a different maintainer).
- Include: affected component (`@testneo/mcp-server` vs TestNeo SaaS API), reproduction steps, and impact if known.

We aim to acknowledge within a few business days; timelines depend on severity and capacity.

## Scope

- **In scope for this repo:** the MCP Node process (dependency issues, mishandling of secrets in logs, unsafe defaults in this package).
- **Out of scope here (report to TestNeo / your deployment owner):** API authorization bugs, data leaks in the hosted product, account takeover in the web app—the MCP is only an HTTP client to your configured **`TESTNEO_BASE_URL`**.

## Operational guidance

- Store **`TESTNEO_API_KEY`** only in environment variables or your IDE’s secret store—never commit it.
- Keep **`TESTNEO_MCP_ALLOW_WRITE=false`** unless you intentionally want tools that mutate data or run tests.
- Prefer **`confirm=true`** only in controlled sessions; use **`idempotency_key`** on write tools for safe retries.
