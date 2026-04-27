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

test("workspace renders a restore-closed-tab control beside the browser-tab button", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /class="toolbar-button restore-tab"/);
  assert.match(html, /aria-label="Restore most recently closed chat tab"/);
  assert.match(html, /title="Restore most recently closed chat tab"/);
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

test("workspace closes tabs on middle click", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /tabList\.addEventListener\('auxclick'/);
  assert.match(html, /event\.button !== 1/);
  assert.match(html, /event\.preventDefault\(\);/);
  assert.match(html, /closeTab\(tab\);/);
});

test("workspace handles keyboard shortcuts for creating and switching tabs", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const shortcutSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "keyboard-shortcuts.js"),
    "utf8",
  );

  assert.equal(html.includes(shortcutSource), true);
  assert.match(html, /function activateRelativeTab\(direction\)/);
  assert.match(html, /function handleWorkspaceShortcut\(action\)/);
  assert.match(html, /document\.addEventListener\('keydown', handleWorkspaceKeydown\);/);
  assert.match(html, /handleWorkspaceShortcut\(event\.data\.action\);/);
});

test("workspace asks a new chat tab to focus the Ask anything prompt", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /function focusChatPrompt\(tab\)/);
  assert.match(html, /type:\s*'focus-chat-prompt'/);
  assert.match(html, /focusChatPrompt\(tab\);\s*return;/);
});

test("workspace persists and restores a closed tab stack in reverse close order", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /const restoreTabButton = document\.querySelector\('\.restore-tab'\);/);
  assert.match(html, /closedTabs:\s*getClosedTabs\(\)/);
  assert.match(html, /function updateRestoreTabButtonState\(\)/);
  assert.match(html, /restoreTabButton\.disabled = getClosedTabs\(\)\.length === 0;/);
  assert.match(html, /closedTabs\.push\(\{\s*id:/s);
  assert.match(html, /function restoreClosedTab\(\)/);
  assert.match(html, /const tabState = getClosedTabs\(\)\.pop\(\);/);
  assert.match(html, /event\.target\.closest\('\.restore-tab'\)\)\s*\{\s*restoreClosedTab\(\);/s);
});
