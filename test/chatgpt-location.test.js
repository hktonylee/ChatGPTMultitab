const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("chatgpt content script forwards workspace keyboard shortcuts to the parent frame", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "chatgpt-location.js"), "utf8");

  assert.match(source, /function postWorkspaceShortcutToParent\(event\)/);
  assert.match(source, /KeyboardShortcuts\.getWorkspaceShortcutAction\(event\)/);
  assert.match(source, /type: "workspace-shortcut"/);
  assert.match(source, /action,/);
  assert.match(source, /document\.addEventListener\("keydown", postWorkspaceShortcutToParent\);/);
});

test("chatgpt content script focuses the Ask anything prompt when the workspace asks", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "chatgpt-location.js"), "utf8");

  assert.match(source, /function findAskAnythingInput\(\)/);
  assert.match(source, /Ask anything/);
  assert.match(source, /function focusAskAnythingInput\(\)/);
  assert.match(source, /type !== "focus-chat-prompt"/);
  assert.match(source, /window\.addEventListener\("message", handleWorkspaceMessage\);/);
});

test("chatgpt content script observes the Ask anything placeholder until it can focus", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "chatgpt-location.js"), "utf8");

  assert.match(source, /\[data-placeholder\*="Ask anything" i\]\.placeholder/);
  assert.match(source, /function observeAskAnythingInput\(\)/);
  assert.match(source, /new MutationObserver/);
  assert.match(source, /observer\.disconnect\(\);/);
  assert.match(source, /observeAskAnythingInput\(\);/);
});
