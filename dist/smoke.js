"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_js_1 = require("./config.js");
const httpClient_js_1 = require("./httpClient.js");
async function run() {
    const config = (0, config_js_1.loadConfig)(process.env);
    const client = new httpClient_js_1.HttpClient(config);
    const validate = await client.request("/api/web/v1/playwright-sdk/validate", { method: "POST" });
    const projects = await client.request("/api/web/v1/playwright-sdk/projects", { query: { limit: 5, offset: 0 } });
    process.stdout.write("Smoke check passed.\n");
    process.stdout.write(`Validated user context: ${JSON.stringify(validate).slice(0, 200)}\n`);
    process.stdout.write(`Projects (${projects.total} total): ${(projects.projects || [])
        .map((p) => `${p.id}:${p.name}`)
        .join(", ")}\n`);
}
run().catch((error) => {
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[testneo-mcp-server smoke] failed: ${msg}\n`);
    process.exit(1);
});
