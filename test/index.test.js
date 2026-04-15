const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("workspace page injects session state inline instead of fetching a relative script", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const sessionStateSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "session-state.js"),
    "utf8",
  );

  assert.equal(html.includes('<script src="src/session-state.js"></script>'), false);
  assert.match(html, /function attachSessionState\(root\)/);
  assert.equal(html.includes(sessionStateSource), true);
});

test("workspace page asks before closing when multiple chat tabs are open", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /function shouldConfirmPageClose\(\)/);
  assert.match(html, /return getTabs\(\)\.length > 1;/);
  assert.match(html, /window\.addEventListener\('beforeunload'/);
  assert.match(html, /event\.preventDefault\(\);/);
  assert.match(html, /event\.returnValue = '';/);
});

test("open-chat-in-browser-tab control is pinned to the right edge of the tab bar", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /\.open-tab\s*\{[^}]*margin-left:\s*auto;/s);
});

test("workspace keeps one preloaded chat tab ready in the background", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /let cachedChatTab = null;/);
  assert.match(html, /function ensureCachedChatTab\(\)/);
  assert.match(html, /function promoteCachedChatTab\(\)/);
  assert.match(html, /cachedChatTab = \{\s*tabState,\s*panel,\s*\};/s);
  assert.match(html, /const tab = promoteCachedChatTab\(\);/);
  assert.match(html, /ensureCachedChatTab\(\);/);
});
