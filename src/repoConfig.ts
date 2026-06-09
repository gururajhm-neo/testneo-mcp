import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type RepoConfigDefaults = {
  project_id?: number;
  generate_engine?: "heuristic" | "langgraph";
  generate_if_unmapped?: boolean;
  auto_sync_structure?: boolean;
  auto_release_bundle?: boolean;
  confirm?: boolean;
  sync_jira_before_validate?: boolean;
  gate_policy?: "both" | "no_block" | "min_confidence" | "warn_only";
  gate_threshold?: number;
  target_env?: string;
};

/** Parse minimal flat YAML (key: value) — no external deps. */
function parseSimpleYaml(text: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let raw = trimmed.slice(idx + 1).trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    if (raw === "true") out[key] = true;
    else if (raw === "false") out[key] = false;
    else if (/^-?\d+$/.test(raw)) out[key] = parseInt(raw, 10);
    else if (/^-?\d+\.\d+$/.test(raw)) out[key] = parseFloat(raw);
    else out[key] = raw;
  }
  return out;
}

function loadRawConfig(workspaceRoot: string): Record<string, string | number | boolean> {
  const yamlPath = join(workspaceRoot, ".testneo", "config.yaml");
  const jsonPath = join(workspaceRoot, ".testneo", "config.json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, string | number | boolean>;
    } catch {
      return {};
    }
  }
  if (existsSync(yamlPath)) {
    try {
      return parseSimpleYaml(readFileSync(yamlPath, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

export function loadRepoConfigDefaults(workspaceRoot?: string): RepoConfigDefaults {
  const root = workspaceRoot?.trim() || process.cwd();
  const raw = loadRawConfig(root);
  const defaults: RepoConfigDefaults = {};
  if (typeof raw.project_id === "number") defaults.project_id = raw.project_id;
  if (raw.generate_engine === "heuristic" || raw.generate_engine === "langgraph") {
    defaults.generate_engine = raw.generate_engine;
  }
  if (typeof raw.generate_if_unmapped === "boolean") {
    defaults.generate_if_unmapped = raw.generate_if_unmapped;
  }
  if (typeof raw.auto_sync_structure === "boolean") {
    defaults.auto_sync_structure = raw.auto_sync_structure;
  }
  if (typeof raw.auto_release_bundle === "boolean") {
    defaults.auto_release_bundle = raw.auto_release_bundle;
  }
  if (typeof raw.confirm === "boolean") defaults.confirm = raw.confirm;
  if (typeof raw.sync_jira_before_validate === "boolean") {
    defaults.sync_jira_before_validate = raw.sync_jira_before_validate;
  }
  if (
    raw.gate_policy === "both" ||
    raw.gate_policy === "no_block" ||
    raw.gate_policy === "min_confidence" ||
    raw.gate_policy === "warn_only"
  ) {
    defaults.gate_policy = raw.gate_policy;
  }
  if (typeof raw.gate_threshold === "number") defaults.gate_threshold = raw.gate_threshold;
  if (typeof raw.target_env === "string") defaults.target_env = raw.target_env;
  return defaults;
}

/** Tool params override repo defaults; repo defaults override schema defaults. */
export function mergeRepoConfigIntoWorkflowParams<T extends Record<string, unknown>>(
  params: T,
  workspaceRoot?: string,
): T {
  const repo = loadRepoConfigDefaults(workspaceRoot || process.cwd());
  const merged = { ...params } as T & RepoConfigDefaults;
  for (const [k, v] of Object.entries(repo)) {
    if (merged[k as keyof T] === undefined || merged[k as keyof T] === null) {
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  return merged as T;
}
