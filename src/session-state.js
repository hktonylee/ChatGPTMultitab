(function attachSessionState(root) {
  const DEFAULT_CHAT_URL = "https://chatgpt.com/";

  function createTabState(id, title = `Chat ${id}`, url = DEFAULT_CHAT_URL) {
    const numericId = Number(id);
    const normalizedTitle = String(title || "").trim() || `Chat ${numericId}`;

    return {
      id: numericId,
      title: normalizedTitle,
      url: normalizeTabUrl(url),
    };
  }

  function buildInitialTabState() {
    return {
      activeTabId: 1,
      nextChatId: 2,
      tabs: [createTabState(1)],
    };
  }

  function normalizeTabUrl(url) {
    try {
      return new URL(String(url || "").trim()).href;
    } catch (_error) {
      return DEFAULT_CHAT_URL;
    }
  }

  function sanitizeStoredTabState(storedState) {
    const rawTabs = Array.isArray(storedState?.tabs) ? storedState.tabs : [];
    const tabs = rawTabs
      .map((tab) => {
        const id = Number(tab?.id);

        if (!Number.isInteger(id) || id < 1) {
          return null;
        }

        return createTabState(id, tab?.title, tab?.url);
      })
      .filter(Boolean);

    if (tabs.length === 0) {
      return buildInitialTabState();
    }

    const maxId = tabs.reduce((currentMax, tab) => Math.max(currentMax, tab.id), 0);
    const activeTabId = tabs.some((tab) => tab.id === storedState?.activeTabId)
      ? Number(storedState.activeTabId)
      : tabs[0].id;
    const nextChatId = Math.max(Number(storedState?.nextChatId) || 0, maxId + 1);

    return {
      activeTabId,
      nextChatId,
      tabs,
    };
  }

  const api = {
    DEFAULT_CHAT_URL,
    buildInitialTabState,
    createTabState,
    normalizeTabUrl,
    sanitizeStoredTabState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.SessionState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
