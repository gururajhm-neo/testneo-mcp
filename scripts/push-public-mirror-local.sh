#!/usr/bin/env bash
# Sync this package to your local testneo-mcp clone and git push (uses YOUR normal GitHub auth — no MCP_PUBLIC_MIRROR_PUSH_TOKEN).
#
# Usage (example path — use YOUR clone directory):
#   ./scripts/push-public-mirror-local.sh ~/Documents/testneo-mcp
#   TESTNEO_MCP_PUBLIC_REPO=~/Documents/testneo-mcp ./scripts/push-public-mirror-local.sh
#
# Prerequisites: clone once → git remote origin = https://github.com/gururajhm-neo/testneo-mcp.git (or SSH URL)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEST="${1:-${TESTNEO_MCP_PUBLIC_REPO:-}}"
MONO_ROOT="$(cd "${PKG_ROOT}/../.." && pwd)"
if [[ -f "${MONO_ROOT}/docs/mcp-tool-reference.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp-tool-reference.md" "${PKG_ROOT}/docs/MCP_TOOL_REFERENCE.md"
fi
if [[ -f "${MONO_ROOT}/docs/mcp-non-saucedemo-testing.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp-non-saucedemo-testing.md" "${PKG_ROOT}/docs/MCP_NON_SAUCE_DEMO_TESTING.md"
fi

if [[ -z "${DEST}" ]]; then
  echo "Usage: $0 <absolute-path-to-your-testneo-mcp-git-clone>" >&2
  echo "Example:  $0 \$HOME/Documents/testneo-mcp" >&2
  echo "Or set env: TESTNEO_MCP_PUBLIC_REPO=\$HOME/Documents/testneo-mcp $0" >&2
  exit 1
fi

"${SCRIPT_DIR}/sync-public-mcp-repo.sh" "${DEST}"

cd "${DEST}"
git add -A
if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit — public mirror already matches this package."
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
MSG="chore(mcp): sync from testneo-api ($(date -u +%Y-%m-%d))"
git commit -m "${MSG}"
git push origin "${BRANCH}"

echo "Pushed to origin/${BRANCH}"
