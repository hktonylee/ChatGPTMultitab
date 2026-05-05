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

test("workspace renders new-tab and reopen-closed-tab actions inside the plus menu", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /class="add-tab-menu"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /<div class="tab-action-menu" id="new-tab-menu" role="menu" hidden>/);
  assert.match(html, /class="tab-menu-item new-tab-menu-item"[^>]*>\s*New tab\s*<\/button>/s);
  assert.match(html, /class="tab-menu-item reopen-tab-menu-item"[^>]*>\s*Reopen closed tab\s*<\/button>/s);
  assert.equal(html.includes('class="toolbar-button restore-tab"'), false);
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

  assert.match(html, /const reopenTabMenuItem = document\.querySelector\('\.reopen-tab-menu-item'\);/);
  assert.match(html, /closedTabs:\s*getClosedTabs\(\)/);
  assert.match(html, /function updateRestoreTabButtonState\(\)/);
  assert.match(html, /reopenTabMenuItem\.disabled = getClosedTabs\(\)\.length === 0;/);
  assert.match(html, /closedTabs\.push\(\{\s*id:/s);
  assert.match(html, /function restoreClosedTab\(\)/);
  assert.match(html, /const tabState = getClosedTabs\(\)\.pop\(\);/);
  assert.match(html, /function openNewTabMenu\(\)/);
  assert.match(html, /function closeNewTabMenu\(\)/);
  assert.match(html, /event\.target\.closest\('\.reopen-tab-menu-item'\)\)\s*\{\s*restoreClosedTab\(\);/s);
});

test("workspace reloads only the latest five restored iframes and sleeps the rest", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /const RESTORED_IFRAME_LIMIT = 5;/);
  assert.match(html, /\.tab\[data-sleeping="true"\]\s*\{[^}]*color:\s*#8a8a8a;/s);
  assert.match(html, /function wakeSleepingTab\(tab\)/);
  assert.match(html, /function createChatPanel\(tabState,\s*\{\s*loadIframe = true\s*\} = \{\}\)/);
  assert.match(html, /panel\.dataset\.sleepingChatUrl = tabState\.url;/);
  assert.match(html, /tab\.dataset\.sleeping = 'true';/);
  assert.match(html, /panel\?\.dataset\.sleepingChatUrl\s*\|\|/);
  assert.match(html, /session\.tabs\.length - RESTORED_IFRAME_LIMIT/);
  assert.match(html, /createChatTab\(tabState,\s*\{\s*loadIframe:\s*index >= firstLoadedTabIndex/s);
  assert.match(html, /wakeSleepingTab\(tab\);[\s\S]*const tabs = getTabs\(\);/);
});

test("workspace unloads iframes after three inactive hours and wakes them on activation", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /const AUTO_SLEEP_AFTER_MS = 3 \* 60 \* 60 \* 1000;/);
  assert.match(html, /const AUTO_SLEEP_CHECK_INTERVAL_MS = 60 \* 1000;/);
  assert.match(html, /function sleepChatPanel\(tab,\s*panel\)/);
  assert.match(html, /panel\.dataset\.sleepingChatUrl =[\s\S]*iframe\?\.dataset\.reportedChatUrl/s);
  assert.match(html, /iframe\.remove\(\);/);
  assert.match(html, /function sleepInactiveTabs\(now = Date\.now\(\)\)/);
  assert.match(html, /tab\.getAttribute\('aria-selected'\) === 'true'/);
  assert.match(html, /now - lastActiveAt < AUTO_SLEEP_AFTER_MS/);
  assert.match(html, /window\.setInterval\(sleepInactiveTabs,\s*AUTO_SLEEP_CHECK_INTERVAL_MS\);/);
  assert.match(html, /tab\.dataset\.lastActiveAt = String\(Date\.now\(\)\);[\s\S]*wakeSleepingTab\(tab\);/);
});
