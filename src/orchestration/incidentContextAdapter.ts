/**
 * IncidentContextAdapter — HTTP bridge to Python IncidentContextService.
 *
 * Called by PrValidationOrchestrator after findings are normalized to enrich
 * validate_pr with Release Memory (prior validations + patterns + resolutions).
 */
import type {
  AffectedTestCandidate,
  IncidentContext,
  ValidatePrRequest,
  VerificationFinding,
  WorkflowContext,
} from "./contracts.js";
import { IncidentContextSchema } from "./contracts.js";

export interface IncidentContextLookupClient {
  request<T = unknown>(path: string, opts?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | boolean>;
    timeoutMs?: number;
  }): Promise<T>;
}

export interface IncidentContextAdapter {
  lookup(input: {
    request: ValidatePrRequest;
    context: WorkflowContext;
    findings: VerificationFinding[];
    affectedTests: AffectedTestCandidate[];
  }): Promise<IncidentContext | undefined>;
}

export function createHttpIncidentContextAdapter(
  client: IncidentContextLookupClient,
): IncidentContextAdapter {
  return {
    lookup: async ({ request, context, findings, affectedTests }) => {
      try {
        const componentLabels = [
          ...new Set(
            affectedTests
              .map((t) => t.component_label?.trim())
              .filter((c): c is string => Boolean(c)),
          ),
        ];

        const body = {
          project_id: request.project_id,
          changed_files: (request.git.changed_files ?? []).map((f) => f.path),
          component_labels: componentLabels,
          affected_test_ids: affectedTests
            .map((t) => t.test_id)
            .filter((id): id is number => typeof id === "number" && id > 0),
          findings: findings.map((f) => ({
            id: f.id,
            title: f.title,
            issue: f.issue,
            flow: f.flow,
            related_test_ids: f.relatedTestIds,
            changed_file_hints: f.changedFileHints,
          })),
          exclude_workflow_id: context.id,
          lookback_days: 30,
          max_matches: 10,
        };

        const raw = await client.request<unknown>("/api/web/v1/incident-context/lookup", {
          method: "POST",
          body,
          timeoutMs: 15_000,
        });

        return IncidentContextSchema.parse(raw);
      } catch {
        // Best-effort — never block validate_pr on memory lookup failure
        return undefined;
      }
    },
  };
}

export function incidentContextFromMetadata(
  metadata: Record<string, unknown>,
): IncidentContext | undefined {
  const raw = metadata.incident_context;
  if (!raw || typeof raw !== "object") return undefined;
  try {
    return IncidentContextSchema.parse(raw);
  } catch {
    return undefined;
  }
}
