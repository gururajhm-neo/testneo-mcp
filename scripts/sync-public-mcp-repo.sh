#!/usr/bin/env bash
# Sync packages/testneo-mcp-server → a standalone git clone (e.g. github.com/gururajhm-neo/testneo-mcp).
#
# Usage (example — replace with YOUR clone path):
#   ./scripts/sync-public-mcp-repo.sh ~/Documents/testneo-mcp
#   TESTNEO_MCP_PUBLIC_REPO=~/Documents/testneo-mcp ./scripts/sync-public-mcp-repo.sh
#
# From monorepo root:
#   packages/testneo-mcp-server/scripts/sync-public-mcp-repo.sh ~/src/testneo-mcp
#
# Then in the public clone:
#   git add -A && git commit -m "Sync MCP package from testneo-api" && git push
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONO_ROOT="$(cd "${PKG_ROOT}/../.." && pwd)"

DEST="${1:-${TESTNEO_MCP_PUBLIC_REPO:-}}"
if [[ -z "${DEST}" ]]; then
  echo "Usage: $0 <absolute-path-to-your-testneo-mcp-git-clone>" >&2
  echo "Example:  $0 \$HOME/Documents/testneo-mcp" >&2
  echo "Or set env: TESTNEO_MCP_PUBLIC_REPO=\$HOME/Documents/testneo-mcp $0" >&2
  exit 1
fi

if [[ ! -d "${DEST}/.git" ]]; then
  echo "Error: ${DEST} is not a git clone (missing .git)." >&2
  exit 1
fi

# Keep bundled tool reference aligned with monorepo canonical doc.
if [[ -f "${MONO_ROOT}/docs/mcp-tool-reference.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp-tool-reference.md" "${PKG_ROOT}/docs/MCP_TOOL_REFERENCE.md"
  echo "Updated docs/MCP_TOOL_REFERENCE.md from docs/mcp-tool-reference.md"
fi
if [[ -f "${MONO_ROOT}/docs/mcp-non-saucedemo-testing.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp-non-saucedemo-testing.md" "${PKG_ROOT}/docs/MCP_NON_SAUCE_DEMO_TESTING.md"
  echo "Updated docs/MCP_NON_SAUCE_DEMO_TESTING.md from docs/mcp-non-saucedemo-testing.md"
fi

rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  "${PKG_ROOT}/" "${DEST}/"

echo "Synced ${PKG_ROOT} → ${DEST}"
echo "Next: cd \"${DEST}\" && git status && npm install && npm run build && npm test && git add -A && git commit && git push"
