import { type ValidatePrRequest, type ValidatePrResponse } from "./orchestration/index.js";
import type { PolicyMode } from "./policyEngine.js";
import type { RouteHardeningRuntimeConfig } from "./routeHardening.js";
import type { HttpClient } from "./httpClient.js";
type SmokeHttpClient = Pick<HttpClient, "request" | "getBaseUrl" | "getWebAppBaseUrl" | "getWebAppPathPrefix" | "longRequestTimeoutMs">;
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
export declare function createValidatePrToolHarness(options: ValidatePrToolHarnessOptions): {
    toolNames: string[];
    invoke: (request: ValidatePrRequest) => Promise<ValidatePrResponse>;
};
export {};
