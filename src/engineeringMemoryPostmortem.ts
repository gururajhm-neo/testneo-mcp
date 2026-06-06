import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { HttpClient } from "./httpClient.js";

export const ENGINEERING_MEMORY_POSTMORTEM_CONTRACT = "engineering_memory_postmortem.v1" as const;

export const MAX_POSTMORTEM_BYTES = 512 * 1024;

export type PostmortemPayload =
  | { ok: true; title: string; body: string; filename?: string }
  | { ok: false; error: string };

export function wrapEngineeringMemoryPostmortem(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    contract_version: ENGINEERING_MEMORY_POSTMORTEM_CONTRACT,
    ...payload,
  };
}

export async function readPostmortemFromPath(md_path: string): Promise<PostmortemPayload> {
  try {
    const trimmed = md_path.trim();
    if (!trimmed) {
      return { ok: false, error: "md_path is empty" };
    }
    const resolved = resolve(process.cwd(), trimmed);
    const cwd = resolve(process.cwd());
    if (!resolved.startsWith(cwd)) {
      return { ok: false, error: "md_path must stay within the workspace directory" };
    }
    const name = basename(resolved).toLowerCase();
    if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
      return { ok: false, error: "md_path must end with .md, .markdown, or .txt" };
    }
    const buf = await readFile(resolved);
    if (!buf.length) {
      return { ok: false, error: "Postmortem file is empty" };
    }
    if (buf.length > MAX_POSTMORTEM_BYTES) {
      return {
        ok: false,
        error: `Postmortem exceeds ${MAX_POSTMORTEM_BYTES} bytes (${buf.length} bytes)`,
      };
    }
    const body = buf.toString("utf-8");
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || basename(resolved, ".md");
    return { ok: true, title: title.slice(0, 512), body, filename: basename(resolved) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ingestPostmortem(
  client: HttpClient,
  project_id: number,
  title: string,
  body: string,
  external_id?: string,
): Promise<Record<string, unknown>> {
  return client.request<Record<string, unknown>>("/api/web/v1/engineering-memory/ingest/postmortem", {
    method: "POST",
    body: {
      project_id,
      title,
      body,
      ...(external_id ? { external_id } : {}),
    },
    timeoutMs: client.longRequestTimeoutMs,
  });
}
