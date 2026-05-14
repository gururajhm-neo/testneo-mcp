#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { HttpClient } from "./httpClient.js";
import { configureToolTelemetry } from "./toolTelemetry.js";
import { registerTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  configureToolTelemetry({ emitJsonl: config.telemetryJsonl });
  const client = new HttpClient(config);

  const server = new McpServer({
    name: "@testneo/mcp-server",
    version: "0.1.1",
  });

  registerTools(server, {
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[testneo-mcp-server] fatal: ${msg}\n`);
  process.exit(1);
});
