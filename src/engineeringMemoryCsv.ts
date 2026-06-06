import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { HttpClient } from "./httpClient.js";
import { decodeSwaggerUploadBase64 } from "./swaggerIntel.js";

export const ENGINEERING_MEMORY_CSV_CONTRACT = "engineering_memory_csv.v1" as const;

/** Product limit — large bug exports stay well under this. */
export const MAX_BUG_CSV_BYTES = 5 * 1024 * 1024;

export type BugCsvPayload =
  | { ok: true; buf: Buffer; blob: Blob; filename: string; sha256: string }
  | { ok: false; error: string };

export function wrapEngineeringMemoryCsv(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    contract_version: ENGINEERING_MEMORY_CSV_CONTRACT,
    ...payload,
  };
}

export function validateBugCsvFilename(filename: string): string | null {
  const name = filename.trim();
  if (!name.toLowerCase().endsWith(".csv")) {
    return "Filename must end with .csv";
  }
  if (!name.length || name.length > 512) {
    return "Filename must be 1–512 characters";
  }
  return null;
}

export async function readBugCsvFromPath(csv_path: string): Promise<BugCsvPayload> {
  try {
    const trimmed = csv_path.trim();
    if (!trimmed) {
      return { ok: false, error: "csv_path is empty" };
    }
    const resolved = resolve(process.cwd(), trimmed);
    const cwd = resolve(process.cwd());
    if (!resolved.startsWith(cwd)) {
      return { ok: false, error: "csv_path must stay within the workspace directory" };
    }
    const fnErr = validateBugCsvFilename(basename(resolved));
    if (fnErr) {
      return { ok: false, error: fnErr };
    }
    const buf = await readFile(resolved);
    if (!buf.length) {
      return { ok: false, error: "CSV file is empty" };
    }
    if (buf.length > MAX_BUG_CSV_BYTES) {
      return {
        ok: false,
        error: `CSV exceeds ${MAX_BUG_CSV_BYTES} bytes (${buf.length} bytes)`,
      };
    }
    const filename = basename(resolved);
    const dec = decodeSwaggerUploadBase64(buf.toString("base64"));
    if (!dec.ok) {
      return { ok: false, error: dec.error };
    }
    return { ok: true, buf: dec.buf, blob: dec.blob, filename, sha256: dec.sha256 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function decodeBugCsvBase64(
  base64: string,
  filename: string,
): BugCsvPayload {
  const fnErr = validateBugCsvFilename(filename);
  if (fnErr) {
    return { ok: false, error: fnErr };
  }
  const dec = decodeSwaggerUploadBase64(base64);
  if (!dec.ok) {
    return { ok: false, error: dec.error };
  }
  if (dec.buf.length > MAX_BUG_CSV_BYTES) {
    return {
      ok: false,
      error: `CSV exceeds ${MAX_BUG_CSV_BYTES} bytes (${dec.buf.length} bytes)`,
    };
  }
  return {
    ok: true,
    buf: dec.buf,
    blob: dec.blob,
    filename: filename.trim(),
    sha256: dec.sha256,
  };
}

export type BugCsvSource =
  | { kind: "path"; csv_path: string }
  | { kind: "base64"; csv_file_base64: string; csv_filename: string };

export async function resolveBugCsvSource(source: BugCsvSource): Promise<BugCsvPayload> {
  if (source.kind === "path") {
    return readBugCsvFromPath(source.csv_path);
  }
  return decodeBugCsvBase64(source.csv_file_base64, source.csv_filename);
}

export async function ingestEngineeringMemoryCsv(
  client: HttpClient,
  project_id: number,
  blob: Blob,
  filename: string,
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", blob, filename);
  return client.requestMultipart<Record<string, unknown>>(
    `/api/web/v1/engineering-memory/ingest/csv?project_id=${project_id}`,
    form,
    client.longRequestTimeoutMs,
  );
}
