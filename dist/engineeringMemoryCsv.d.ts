import type { HttpClient } from "./httpClient.js";
export declare const ENGINEERING_MEMORY_CSV_CONTRACT: "engineering_memory_csv.v1";
/** Product limit — large bug exports stay well under this. */
export declare const MAX_BUG_CSV_BYTES: number;
export type BugCsvPayload = {
    ok: true;
    buf: Buffer;
    blob: Blob;
    filename: string;
    sha256: string;
} | {
    ok: false;
    error: string;
};
export declare function wrapEngineeringMemoryCsv(payload: Record<string, unknown>): Record<string, unknown>;
export declare function validateBugCsvFilename(filename: string): string | null;
export declare function readBugCsvFromPath(csv_path: string): Promise<BugCsvPayload>;
export declare function decodeBugCsvBase64(base64: string, filename: string): BugCsvPayload;
export type BugCsvSource = {
    kind: "path";
    csv_path: string;
} | {
    kind: "base64";
    csv_file_base64: string;
    csv_filename: string;
};
export declare function resolveBugCsvSource(source: BugCsvSource): Promise<BugCsvPayload>;
export declare function ingestEngineeringMemoryCsv(client: HttpClient, project_id: number, blob: Blob, filename: string): Promise<Record<string, unknown>>;
