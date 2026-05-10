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
}): void;
