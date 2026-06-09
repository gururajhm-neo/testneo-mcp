import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  DeveloperReleaseWorkflowInputSchema,
  type DeveloperReleaseWorkflowInput,
} from "./developerReleaseWorkflow.js";
import { mergeRepoConfigIntoWorkflowParams } from "./repoConfig.js";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, ".testneo", "config.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function run(): Promise<void> {
  const base = {
    repository: { owner: "demo", name: "tasker" },
    pull_request: { number: 1 },
    git: { base_sha: "abc1234567890", head_sha: "def1234567890" },
  };

  const start = process.env.TESTNEO_REPO_ROOT?.trim() || process.cwd();
  const repoRoot = findRepoRoot(start);
  const merged = mergeRepoConfigIntoWorkflowParams(
    { ...base, project_id: 99 } as DeveloperReleaseWorkflowInput,
    repoRoot,
  );

  const parsed = DeveloperReleaseWorkflowInputSchema.parse(merged);
  assert(parsed.project_id === 99, "explicit project_id must win over repo config");
  assert(
    parsed.generate_engine === "langgraph" || parsed.generate_engine === "heuristic",
    "generate_engine must be valid enum",
  );
  assert(typeof parsed.generate_if_unmapped === "boolean", "generate_if_unmapped boolean");

  console.log("developerReleaseWorkflowSmoke: OK");
  console.log(
    JSON.stringify({
      project_id: parsed.project_id,
      generate_engine: parsed.generate_engine,
      generate_if_unmapped: parsed.generate_if_unmapped,
      gate_threshold: parsed.gate_threshold,
    }),
  );
}

run().catch((err) => {
  console.error("developerReleaseWorkflowSmoke: FAIL", err);
  process.exit(1);
});
