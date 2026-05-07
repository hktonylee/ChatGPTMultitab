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

test("chatgpt content script does not try to focus the Ask anything prompt", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "chatgpt-location.js"), "utf8");

  assert.doesNotMatch(source, /focus-chat-prompt/);
  assert.doesNotMatch(source, /Ask anything/);
  assert.doesNotMatch(source, /handleWorkspaceMessage/);
  assert.doesNotMatch(source, /window\.addEventListener\("message"/);
});

test("chatgpt content script reports iframe url to the extension background", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "chatgpt-location.js"), "utf8");

  assert.match(source, /function reportLocationToExtension\(url\)/);
  assert.match(source, /type: "chatgptFrameLocation"/);
  assert.match(source, /chrome\.runtime\.sendMessage/);
  assert.match(source, /reportLocationToExtension\(url\);/);
});
