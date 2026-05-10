import { loadConfig } from "./config.js";
import { HttpClient } from "./httpClient.js";

async function run(): Promise<void> {
  const config = loadConfig(process.env);
  const client = new HttpClient(config);

  const validate = await client.request("/api/web/v1/playwright-sdk/validate", { method: "POST" });
  const projects = await client.request<{ projects: Array<{ id: number; name: string }>; total: number }>(
    "/api/web/v1/playwright-sdk/projects",
    { query: { limit: 5, offset: 0 } }
  );

  process.stdout.write("Smoke check passed.\n");
  process.stdout.write(`Validated user context: ${JSON.stringify(validate).slice(0, 200)}\n`);
  process.stdout.write(
    `Projects (${projects.total} total): ${(projects.projects || [])
      .map((p) => `${p.id}:${p.name}`)
      .join(", ")}\n`
  );
}

run().catch((error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[testneo-mcp-server smoke] failed: ${msg}\n`);
  process.exit(1);
});
