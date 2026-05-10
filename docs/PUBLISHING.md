# Publishing the MCP server (public mirror)

The canonical implementation lives in the private **testneo-api** monorepo under `packages/testneo-mcp-server/`.

The **public** GitHub repo ([gururajhm-neo/testneo-mcp](https://github.com/gururajhm-neo/testneo-mcp)) should contain **only** the contents of this directory (repo root = package root).

## One-time setup

1. Clone the public repo next to your monorepo (or anywhere):

   ```bash
   git clone https://github.com/gururajhm-neo/testneo-mcp.git
   ```

2. From **testneo-api**, after changing this package:

   ```bash
   cd packages/testneo-mcp-server
   ./scripts/sync-public-mcp-repo.sh /path/to/testneo-mcp
   ```

3. In the **testneo-mcp** clone:

   ```bash
   cd /path/to/testneo-mcp
   npm install
   npm run build
   npm test
   git add -A
   git status   # review
   git commit -m "Sync MCP package from testneo-api monorepo"
   git push
   ```

## MCP Market

Submit the public repo URL: **https://github.com/gururajhm-neo/testneo-mcp**

## License

This package is **GPL-3.0** (see `LICENSE`). Ensure your organization is comfortable open-sourcing **this client code** under GPLv3; it does not automatically GPL your private API server code.
