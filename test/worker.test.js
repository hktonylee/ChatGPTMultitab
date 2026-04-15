const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("cloudflare worker response returns index html", async () => {
  const { createWorker } = await import("../src/worker-response.mjs");
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const worker = createWorker(indexHtml);

  const response = await worker.fetch(new Request("https://example.com/anything"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), indexHtml);
});

test("wrangler config points at the worker and imports html as text", () => {
  const config = fs.readFileSync(path.join(__dirname, "..", "wrangler.toml"), "utf8");

  assert.match(config, /^main = "src\/worker\.mjs"$/m);
  assert.match(config, /^\[\[rules\]\]$/m);
  assert.match(config, /type = "Text"/);
  assert.match(config, /globs = \["\*\*\/\*\.html"\]/);
});
