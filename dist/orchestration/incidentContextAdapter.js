"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpIncidentContextAdapter = createHttpIncidentContextAdapter;
exports.incidentContextFromMetadata = incidentContextFromMetadata;
const contracts_js_1 = require("./contracts.js");
function createHttpIncidentContextAdapter(client) {
    return {
        lookup: async ({ request, context, findings, affectedTests }) => {
            try {
                const componentLabels = [
                    ...new Set(affectedTests
                        .map((t) => t.component_label?.trim())
                        .filter((c) => Boolean(c))),
                ];
                const body = {
                    project_id: request.project_id,
                    changed_files: (request.git.changed_files ?? []).map((f) => f.path),
                    component_labels: componentLabels,
                    affected_test_ids: affectedTests
                        .map((t) => t.test_id)
                        .filter((id) => typeof id === "number" && id > 0),
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
                const raw = await client.request("/api/web/v1/incident-context/lookup", {
                    method: "POST",
                    body,
                    timeoutMs: 15_000,
                });
                return contracts_js_1.IncidentContextSchema.parse(raw);
            }
            catch {
                // Best-effort — never block validate_pr on memory lookup failure
                return undefined;
            }
        },
    };
}
function incidentContextFromMetadata(metadata) {
    const raw = metadata.incident_context;
    if (!raw || typeof raw !== "object")
        return undefined;
    try {
        return contracts_js_1.IncidentContextSchema.parse(raw);
    }
    catch {
        return undefined;
    }
}
