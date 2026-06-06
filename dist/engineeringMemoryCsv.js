"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BUG_CSV_BYTES = exports.ENGINEERING_MEMORY_CSV_CONTRACT = void 0;
exports.wrapEngineeringMemoryCsv = wrapEngineeringMemoryCsv;
exports.validateBugCsvFilename = validateBugCsvFilename;
exports.readBugCsvFromPath = readBugCsvFromPath;
exports.decodeBugCsvBase64 = decodeBugCsvBase64;
exports.resolveBugCsvSource = resolveBugCsvSource;
exports.ingestEngineeringMemoryCsv = ingestEngineeringMemoryCsv;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const swaggerIntel_js_1 = require("./swaggerIntel.js");
exports.ENGINEERING_MEMORY_CSV_CONTRACT = "engineering_memory_csv.v1";
/** Product limit — large bug exports stay well under this. */
exports.MAX_BUG_CSV_BYTES = 5 * 1024 * 1024;
function wrapEngineeringMemoryCsv(payload) {
    return {
        contract_version: exports.ENGINEERING_MEMORY_CSV_CONTRACT,
        ...payload,
    };
}
function validateBugCsvFilename(filename) {
    const name = filename.trim();
    if (!name.toLowerCase().endsWith(".csv")) {
        return "Filename must end with .csv";
    }
    if (!name.length || name.length > 512) {
        return "Filename must be 1–512 characters";
    }
    return null;
}
async function readBugCsvFromPath(csv_path) {
    try {
        const trimmed = csv_path.trim();
        if (!trimmed) {
            return { ok: false, error: "csv_path is empty" };
        }
        const resolved = (0, node_path_1.resolve)(process.cwd(), trimmed);
        const cwd = (0, node_path_1.resolve)(process.cwd());
        if (!resolved.startsWith(cwd)) {
            return { ok: false, error: "csv_path must stay within the workspace directory" };
        }
        const fnErr = validateBugCsvFilename((0, node_path_1.basename)(resolved));
        if (fnErr) {
            return { ok: false, error: fnErr };
        }
        const buf = await (0, promises_1.readFile)(resolved);
        if (!buf.length) {
            return { ok: false, error: "CSV file is empty" };
        }
        if (buf.length > exports.MAX_BUG_CSV_BYTES) {
            return {
                ok: false,
                error: `CSV exceeds ${exports.MAX_BUG_CSV_BYTES} bytes (${buf.length} bytes)`,
            };
        }
        const filename = (0, node_path_1.basename)(resolved);
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(buf.toString("base64"));
        if (!dec.ok) {
            return { ok: false, error: dec.error };
        }
        return { ok: true, buf: dec.buf, blob: dec.blob, filename, sha256: dec.sha256 };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
function decodeBugCsvBase64(base64, filename) {
    const fnErr = validateBugCsvFilename(filename);
    if (fnErr) {
        return { ok: false, error: fnErr };
    }
    const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(base64);
    if (!dec.ok) {
        return { ok: false, error: dec.error };
    }
    if (dec.buf.length > exports.MAX_BUG_CSV_BYTES) {
        return {
            ok: false,
            error: `CSV exceeds ${exports.MAX_BUG_CSV_BYTES} bytes (${dec.buf.length} bytes)`,
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
async function resolveBugCsvSource(source) {
    if (source.kind === "path") {
        return readBugCsvFromPath(source.csv_path);
    }
    return decodeBugCsvBase64(source.csv_file_base64, source.csv_filename);
}
async function ingestEngineeringMemoryCsv(client, project_id, blob, filename) {
    const form = new FormData();
    form.append("file", blob, filename);
    return client.requestMultipart(`/api/web/v1/engineering-memory/ingest/csv?project_id=${project_id}`, form, client.longRequestTimeoutMs);
}
