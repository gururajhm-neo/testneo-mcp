import type { ValidatePrRequest } from "./orchestration/index.js";
import { createValidatePrToolHarness } from "./validatePrSmokeHarness.js";

type MockRequestCall = {
  path: string;
  options: unknown;
};

async function run(): Promise<void> {
  const calls: MockRequestCall[] = [];

  const harness = createValidatePrToolHarness({
    allowWriteTools: true,
    client: {
      getBaseUrl: () => "https://mock.testneo.ai",
      getWebAppBaseUrl: () => "https://mock.testneo.ai",
      getWebAppPathPrefix: () => "",
      longRequestTimeoutMs: 15_000,
      async request<T>(path: string, options: unknown = {}): Promise<T> {
        calls.push({ path, options });

        if (path === "/api/web/v1/playwright-sdk/validate") {
          return {
            tenant_id: "tenant_mock_001",
            user_id: 7,
          } as T;
        }

        if (path === "/api/web/v1/code-impact/analyze/manual") {
          return {
            success: true,
            summary: {
              total_changed_files: 2,
              total_impacted_tests: 2,
            },
            recommendations: [
              "Run checkout smoke suite",
              "Run cart regression suite",
            ],
            affected_tests: [
              {
                test_id: 201,
                test_name: "Checkout guest purchase",
                function_name: "handleCheckoutSubmit",
                confidence: 0.94,
                impact_level: "high",
                reason: "Checkout submit flow changed in the PR diff",
              },
              {
                test_id: 305,
                test_name: "Cart summary pricing",
                function_name: "renderCartSummary",
                confidence: 0.81,
                impact_level: "medium",
                reason: "Cart summary component was directly modified",
              },
            ],
          } as T;
        }

        if (path === "/api/web/v1/test-cases/201/execute") {
          return {
            success: true,
            execution_id: "exec-201",
          } as T;
        }

        if (path === "/api/web/v1/test-cases/305/execute") {
          return {
            success: true,
            execution_id: "exec-305",
          } as T;
        }

        if (path === "/api/web/v1/analytics/execution/exec-201/summary") {
          return {
            execution_id: "exec-201",
            project_id: 42,
            status: "passed",
            total_steps: 5,
            completed_steps: 5,
            failed_steps: 0,
            duration_ms: 4200,
          } as T;
        }

        if (path === "/api/web/v1/analytics/execution/exec-305/summary") {
          return {
            execution_id: "exec-305",
            project_id: 42,
            status: "failed",
            total_steps: 4,
            completed_steps: 3,
            failed_steps: 1,
            duration_ms: 3100,
            error_message: "Price assertion mismatch in cart summary.",
          } as T;
        }

        if (path === "/api/web/v1/playwright-sdk/executions/exec-201") {
          return {
            api_version: "v1",
            data: {
              execution_id: "exec-201",
              project_id: 42,
              status: "passed",
              total_steps: 5,
              completed_steps: 5,
              failed_steps: 0,
              duration_ms: 4200,
            },
          } as T;
        }

        if (path === "/api/web/v1/playwright-sdk/executions/exec-305") {
          return {
            api_version: "v1",
            data: {
              execution_id: "exec-305",
              project_id: 42,
              status: "failed",
              total_steps: 4,
              completed_steps: 3,
              failed_steps: 1,
              duration_ms: 3100,
              error_message: "Price assertion mismatch in cart summary.",
            },
          } as T;
        }

        throw new Error(`Unexpected mock backend path: ${path}`);
      },
    },
  });

  const request: ValidatePrRequest = {
    project_id: 42,
    repository: {
      owner: "acme",
      name: "shop-web",
    },
    pull_request: {
      number: 128,
      url: "https://github.com/acme/shop-web/pull/128",
    },
    git: {
      base_sha: "abc1234",
      head_sha: "def5678",
      diff_content: "diff --git a/src/pages/Checkout.tsx b/src/pages/Checkout.tsx",
      changed_files: [
        {
          path: "src/pages/Checkout.tsx",
          status: "modified",
          additions: 42,
          deletions: 8,
          language: "typescript",
        },
        {
          path: "src/components/CartSummary.tsx",
          status: "modified",
          additions: 14,
          deletions: 3,
          language: "typescript",
        },
      ],
    },
    execution: {
      run_impacted_tests: true,
      run_visual_regression: true,
      run_lighthouse: true,
      capture_replay: true,
      max_parallelism: 4,
    },
    output: {
      include_comment_draft: true,
      publish_comment: false,
    },
    idempotency_key: "mock-pr-42-128-def5678",
    confirm: true,
  };

  const first = await harness.invoke(request);
  const second = await harness.invoke(request);

  if (first.contract_version !== "pr_validation.v1") {
    throw new Error(`Unexpected contract version: ${first.contract_version}`);
  }
  if (first.status !== "failed") {
    throw new Error(`Expected first run to be failed, received ${first.status}`);
  }
  if (second.workflow_id !== first.workflow_id) {
    throw new Error("Expected second run to replay the same workflow id");
  }
  if (!second.metadata.replayed) {
    throw new Error("Expected second run metadata.replayed to be true");
  }
  if ((first.findings || []).length !== 2) {
    throw new Error(`Expected 2 findings, received ${first.findings.length}`);
  }

  process.stdout.write("validate_pr mock smoke passed.\n");
  process.stdout.write(
    `${JSON.stringify(
      {
        toolNames: harness.toolNames,
        backendCalls: calls,
        assertions: {
          firstStatus: first.status,
          secondStatus: second.status,
          sameWorkflowIdOnReplay: first.workflow_id === second.workflow_id,
          replayedOnSecondRun: second.metadata.replayed,
          findings: first.findings.length,
          executionMode: first.metadata.execution_mode,
          plannedStages: Object.values(first.execution_summary).filter(Boolean).length,
        },
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[testneo_validate_pr mock smoke] failed: ${msg}\n`);
  process.exit(1);
});
