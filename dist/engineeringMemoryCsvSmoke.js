"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Smoke: ingest bug CSV via MCP helper → incident lookup for orders/migration files.
 *
 * Env:
 *   TESTNEO_API_KEY (required)
 *   TESTNEO_BASE_URL (default http://127.0.0.1:8001)
 *   TESTNEO_PROJECT_ID (default 10)
 *   TESTNEO_BUG_CSV_PATH (default scripts/fixtures/project10_engineering_memory_bugs.csv)
 */
const config_js_1 = require("./config.js");
const httpClient_js_1 = require("./httpClient.js");
const engineeringMemoryCsv_js_1 = require("./engineeringMemoryCsv.js");
function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value)
        throw new Error(`Missing required env var ${name}`);
    return value;
}
async function run() {
    requireEnv("TESTNEO_API_KEY");
    const projectId = Number(process.env.TESTNEO_PROJECT_ID?.trim() || "10");
    const csvPath = process.env.TESTNEO_BUG_CSV_PATH?.trim() ||
        "scripts/fixtures/project10_engineering_memory_bugs.csv";
    const config = (0, config_js_1.loadConfig)(process.env);
    const client = new httpClient_js_1.HttpClient(config);
    const csv = await (0, engineeringMemoryCsv_js_1.readBugCsvFromPath)(csvPath);
    if (!csv.ok) {
        throw new Error(csv.error);
    }
    const ingest = await (0, engineeringMemoryCsv_js_1.ingestEngineeringMemoryCsv)(client, projectId, csv.blob, csv.filename);
    process.stdout.write(`${JSON.stringify((0, engineeringMemoryCsv_js_1.wrapEngineeringMemoryCsv)({ success: true, ingest, csv_sha256: csv.sha256 }), null, 2)}\n`);
    const lookup = await client.request("/api/web/v1/incident-context/lookup", {
        method: "POST",
        body: {
            project_id: projectId,
            changed_files: [
                "migrations/0042_add_fulfillment_status.sql",
                "app/models/order.py",
                "app/services/order_service.py",
            ],
            lookback_days: 90,
            max_matches: 10,
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
    const score = lookup.incident_match_score;
    const count = lookup.match_count;
    const matches = Array.isArray(lookup.matches)
        ? lookup.matches
        : [];
    const em = matches.filter((m) => m.match_type === "engineering_memory").length;
    process.stdout.write(`incident_lookup: score=${score} matches=${count} engineering_memory=${em}\n`);
    const ingestOk = Number(ingest.created ?? 0) + Number(ingest.updated ?? 0) > 0 ||
        Number(ingest.skipped ?? 0) > 0;
    if (!ingestOk) {
        throw new Error("CSV ingest returned no created/updated/skipped rows");
    }
    if (typeof score !== "number" || count < 1) {
        throw new Error(`Expected incident matches after CSV ingest; got score=${score} count=${count}`);
    }
    process.stdout.write("engineering_memory_csv smoke passed.\n");
}
run().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[engineering_memory_csv smoke] failed: ${msg}\n`);
    process.exit(1);
});
