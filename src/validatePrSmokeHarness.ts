import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ValidatePrRequestSchema,
  ValidatePrResponseSchema,
  type ValidatePrRequest,
  type ValidatePrResponse,
} from "./orchestration/index.js";
import type { PolicyMode } from "./policyEngine.js";
import type { RouteHardeningRuntimeConfig } from "./routeHardening.js";
import type { HttpClient } from "./httpClient.js";
import type { ToolTextResult } from "./types.js";
import { registerTools } from "./tools/index.js";

type SmokeHttpClient = Pick<
  HttpClient,
  "request" | "getBaseUrl" | "getWebAppBaseUrl" | "getWebAppPathPrefix" | "longRequestTimeoutMs"
>;

type RegisteredTool = {
  config: unknown;
  handler: (params: unknown) => Promise<ToolTextResult>;
};

type ValidatePrToolHarnessOptions = {
  client: SmokeHttpClient;
  allowWriteTools?: boolean;
  relaxProjectPreconditions?: boolean;
  policyMode?: PolicyMode;
  routeHardening?: RouteHardeningRuntimeConfig;
  batchExecutionDefaults?: {
    defaultExecutionMode: "local" | "cloud";
    defaultExecutionPlatform: string;
    preferLocalAgent: boolean;
    requireLocalAgentForBatch: boolean;
    waitForAgentMs: number;
    openAgentSetupOnAgentFailure: boolean;
  };
};

class CaptureServer {
  readonly tools = new Map<string, RegisteredTool>();

  registerTool(name: string, config: unknown, handler: (params: unknown) => Promise<ToolTextResult>): void {
    this.tools.set(name, { config, handler });
  }
}

export function createValidatePrToolHarness(options: ValidatePrToolHarnessOptions): {
  toolNames: string[];
  invoke: (request: ValidatePrRequest) => Promise<ValidatePrResponse>;
} {
  const server = new CaptureServer();

  registerTools(server as unknown as McpServer, {
    client: options.client as HttpClient,
    allowWriteTools: options.allowWriteTools ?? false,
    relaxProjectPreconditions: options.relaxProjectPreconditions ?? false,
    policyMode: options.policyMode ?? "warn",
    routeHardening: options.routeHardening ?? {
      enabled: false,
      profile: "none",
      customMap: {},
    },
    batchExecutionDefaults: options.batchExecutionDefaults ?? {
      defaultExecutionMode: "local",
      defaultExecutionPlatform: "local",
      preferLocalAgent: false,
      requireLocalAgentForBatch: false,
      waitForAgentMs: 0,
      openAgentSetupOnAgentFailure: false,
    },
  });

  const validatePrTool = server.tools.get("testneo_validate_pr");
  if (!validatePrTool) {
    throw new Error("testneo_validate_pr tool was not registered");
  }

  return {
    toolNames: [...server.tools.keys()],
    async invoke(rawRequest: ValidatePrRequest): Promise<ValidatePrResponse> {
      const request = ValidatePrRequestSchema.parse(rawRequest);
      const output = await validatePrTool.handler(request);
      const textChunk = output.content[0];
      if (!textChunk || textChunk.type !== "text") {
        throw new Error("testneo_validate_pr returned an unexpected MCP payload");
      }
      return ValidatePrResponseSchema.parse(JSON.parse(textChunk.text));
    },
  };
}
