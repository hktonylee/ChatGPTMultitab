(function attachKeyboardShortcuts(root) {
  function getWorkspaceShortcutAction(event) {
    if (!event || event.altKey || !(event.ctrlKey || event.metaKey)) {
      return "";
    }

    if (String(event.key || "").toLowerCase() === "t") {
      return "new-tab";
    }

    if (event.key === "Tab") {
      return event.shiftKey ? "previous-tab" : "next-tab";
    }

    return "";
  }

  const api = {
    getWorkspaceShortcutAction,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.KeyboardShortcuts = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
