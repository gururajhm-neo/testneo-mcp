import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpClient } from "../httpClient.js";
import { type RouteHardeningRuntimeConfig } from "../routeHardening.js";
import { type PolicyMode } from "../policyEngine.js";
export declare function registerTools(server: McpServer, deps: {
    client: HttpClient;
    allowWriteTools: boolean;
    relaxProjectPreconditions: boolean;
    policyMode: PolicyMode;
    routeHardening: RouteHardeningRuntimeConfig;
    batchExecutionDefaults: {
        defaultExecutionMode: "local" | "cloud";
        defaultExecutionPlatform: string;
        preferLocalAgent: boolean;
        requireLocalAgentForBatch: boolean;
        waitForAgentMs: number;
        openAgentSetupOnAgentFailure: boolean;
    };
}): void;
