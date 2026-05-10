import { type RouteProfile } from "./routeHardening.js";
export type ProjectRouteHardeningConfig = {
    enabled?: boolean;
    profile?: RouteProfile;
    extra_map: Record<string, string>;
};
export declare function parseProjectRouteConfig(project: Record<string, unknown>): ProjectRouteHardeningConfig;
export declare function buildProjectSettingsWithRouteMap(currentProjectSettings: unknown, routeConfig: ProjectRouteHardeningConfig): Record<string, unknown>;
export declare function projectRouteSettingsKey(): string;
