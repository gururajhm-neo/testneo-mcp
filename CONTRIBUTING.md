# Contributing

This package is developed primarily inside the **TestNeo API** monorepo (`testneo-api`) under `packages/testneo-mcp-server/`.

## If you are editing the public mirror only

1. Fork **https://github.com/gururajhm-neo/testneo-mcp** (or the canonical org repo).
2. Run `npm install && npm run build && npm test` locally.
3. Open a PR with a clear description of behavior change and any new env vars or tools.

## If you are editing inside the private monorepo

1. Make changes under `packages/testneo-mcp-server/` in `testneo-api`.
2. Run `npm test` in this directory.
3. Sync to the public repo with `scripts/sync-public-mcp-repo.sh` (see README **Public mirror**), then push from the public clone.

## License

By contributing, you agree your contributions are licensed under the same terms as this project (**GNU General Public License v3.0**). See `LICENSE`.
