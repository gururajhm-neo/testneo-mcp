"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidatePrToolHarness = createValidatePrToolHarness;
const orchestrator_1 = require("@testneo/orchestrator");
const index_js_1 = require("./tools/index.js");
class CaptureServer {
    tools = new Map();
    registerTool(name, config, handler) {
        this.tools.set(name, { config, handler });
    }
}
function createValidatePrToolHarness(options) {
    const server = new CaptureServer();
    (0, index_js_1.registerTools)(server, {
        client: options.client,
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
        async invoke(rawRequest) {
            const request = orchestrator_1.ValidatePrRequestSchema.parse(rawRequest);
            const output = await validatePrTool.handler(request);
            const textChunk = output.content[0];
            if (!textChunk || textChunk.type !== "text") {
                throw new Error("testneo_validate_pr returned an unexpected MCP payload");
            }
            return orchestrator_1.ValidatePrResponseSchema.parse(JSON.parse(textChunk.text));
        },
    };
}
