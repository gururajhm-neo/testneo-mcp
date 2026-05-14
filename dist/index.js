#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const config_js_1 = require("./config.js");
const httpClient_js_1 = require("./httpClient.js");
const toolTelemetry_js_1 = require("./toolTelemetry.js");
const index_js_1 = require("./tools/index.js");
async function main() {
    const config = (0, config_js_1.loadConfig)(process.env);
    (0, toolTelemetry_js_1.configureToolTelemetry)({ emitJsonl: config.telemetryJsonl });
    const client = new httpClient_js_1.HttpClient(config);
    const server = new mcp_js_1.McpServer({
        name: "@testneo/mcp-server",
        version: "0.1.1",
    });
    (0, index_js_1.registerTools)(server, {
        client,
        allowWriteTools: config.allowWriteTools,
        relaxProjectPreconditions: config.relaxProjectPreconditions,
        policyMode: config.policyMode,
        routeHardening: {
            enabled: config.routeHardeningEnabled,
            profile: config.routeProfile,
            customMap: config.routeMapCustom,
        },
        batchExecutionDefaults: {
            defaultExecutionMode: config.defaultExecutionMode,
            defaultExecutionPlatform: config.defaultExecutionPlatform,
            preferLocalAgent: config.preferLocalAgent,
            requireLocalAgentForBatch: config.requireLocalAgentForBatch,
            waitForAgentMs: config.waitForAgentMs,
            openAgentSetupOnAgentFailure: config.openAgentSetupOnAgentFailure,
        },
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[testneo-mcp-server] fatal: ${msg}\n`);
    process.exit(1);
});
