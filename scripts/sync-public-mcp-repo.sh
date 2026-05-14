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
if [[ -f "${MONO_ROOT}/docs/mcp/mcp-tool-reference.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp/mcp-tool-reference.md" "${PKG_ROOT}/docs/MCP_TOOL_REFERENCE.md"
  echo "Updated docs/MCP_TOOL_REFERENCE.md from docs/mcp/mcp-tool-reference.md"
fi
if [[ -f "${MONO_ROOT}/docs/mcp/mcp-non-saucedemo-testing.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp/mcp-non-saucedemo-testing.md" "${PKG_ROOT}/docs/MCP_NON_SAUCE_DEMO_TESTING.md"
  echo "Updated docs/MCP_NON_SAUCE_DEMO_TESTING.md from docs/mcp/mcp-non-saucedemo-testing.md"
fi
if [[ -f "${MONO_ROOT}/docs/mcp/mcp-ai-assistant-and-prompts.md" ]]; then
  cp "${MONO_ROOT}/docs/mcp/mcp-ai-assistant-and-prompts.md" "${PKG_ROOT}/docs/MCP_AI_ASSISTANT_AND_PROMPTS.md"
  echo "Updated docs/MCP_AI_ASSISTANT_AND_PROMPTS.md from docs/mcp/mcp-ai-assistant-and-prompts.md"
fi

# npm bundle uses MCP_*.md names; monorepo uses mcp-*.md — fix cross-links after copy.
if [[ -f "${PKG_ROOT}/docs/MCP_AI_ASSISTANT_AND_PROMPTS.md" ]] || [[ -f "${PKG_ROOT}/docs/MCP_TOOL_REFERENCE.md" ]]; then
  PKG_ROOT="${PKG_ROOT}" python3 - <<'PY'
import os, pathlib

root = pathlib.Path(os.environ["PKG_ROOT"])
ai = root / "docs/MCP_AI_ASSISTANT_AND_PROMPTS.md"
old_related = (
    "**Related:** [MCP tool reference](./mcp-tool-reference.md) · "
    "[MCP quickstart](./mcp-quickstart.md) · [Golden prompt packs](./mcp-prompt-packs.md) · "
    "[Unified context discovery](./mcp-unified-context-discovery.md)"
)
new_related = (
    "**Related:** [MCP tool reference](./MCP_TOOL_REFERENCE.md) · "
    "Quickstart, prompt packs, and context discovery: "
    "[testneo.ai — MCP docs](https://testneo.ai/docs/testneo-mcp.html)"
)
if ai.is_file():
    t = ai.read_text()
    if old_related in t:
        ai.write_text(t.replace(old_related, new_related, 1))

ref = root / "docs/MCP_TOOL_REFERENCE.md"
if ref.is_file():
    t = ref.read_text()
    t2 = (
        t.replace("./mcp-ai-assistant-and-prompts.md", "./MCP_AI_ASSISTANT_AND_PROMPTS.md")
        .replace("./mcp-non-saucedemo-testing.md", "./MCP_NON_SAUCE_DEMO_TESTING.md")
    )
    if t2 != t:
        ref.write_text(t2)

non = root / "docs/MCP_NON_SAUCE_DEMO_TESTING.md"
if non.is_file():
    t = non.read_text()
    t2 = t.replace("./mcp-unified-context-discovery.md", "https://testneo.ai/docs/testneo-mcp.html")
    if t2 != t:
        non.write_text(t2)
PY
fi

rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  "${PKG_ROOT}/" "${DEST}/"

echo "Synced ${PKG_ROOT} → ${DEST}"
echo "Next: cd \"${DEST}\" && git status && npm install && npm run build && npm test && git add -A && git commit && git push"
