const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("workspace page does not fetch session-state.js through a relative script path", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.equal(html.includes('<script src="src/session-state.js"></script>'), false);
  assert.match(html, /function attachSessionState\(root\)/);
});

test("workspace page asks before closing when multiple chat tabs are open", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /function shouldConfirmPageClose\(\)/);
  assert.match(html, /return getTabs\(\)\.length > 1;/);
  assert.match(html, /window\.addEventListener\('beforeunload'/);
  assert.match(html, /event\.preventDefault\(\);/);
  assert.match(html, /event\.returnValue = '';/);
});
