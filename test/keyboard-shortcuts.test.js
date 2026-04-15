const assert = require("node:assert/strict");
const test = require("node:test");

const { getWorkspaceShortcutAction } = require("../src/keyboard-shortcuts");

test("maps ctrl or command t to creating a tab", () => {
  assert.equal(getWorkspaceShortcutAction({ key: "t", ctrlKey: true }), "new-tab");
  assert.equal(getWorkspaceShortcutAction({ key: "T", metaKey: true }), "new-tab");
});

test("maps ctrl or command tab to tab switching", () => {
  assert.equal(getWorkspaceShortcutAction({ key: "Tab", ctrlKey: true }), "next-tab");
  assert.equal(getWorkspaceShortcutAction({ key: "Tab", metaKey: true }), "next-tab");
  assert.equal(
    getWorkspaceShortcutAction({ key: "Tab", ctrlKey: true, shiftKey: true }),
    "previous-tab",
  );
  assert.equal(
    getWorkspaceShortcutAction({ key: "Tab", metaKey: true, shiftKey: true }),
    "previous-tab",
  );
});

test("ignores unrelated and alt-modified keyboard shortcuts", () => {
  assert.equal(getWorkspaceShortcutAction({ key: "t" }), "");
  assert.equal(getWorkspaceShortcutAction({ key: "Tab", shiftKey: true }), "");
  assert.equal(getWorkspaceShortcutAction({ key: "t", ctrlKey: true, altKey: true }), "");
});
