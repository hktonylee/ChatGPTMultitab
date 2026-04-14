(function attachSessionState(root) {
  const DEFAULT_CHAT_URL = "https://chatgpt.com/";
  const DEFAULT_CHAT_TITLE = "ChatGPT";
  const CHATGPT_HOSTNAME = "chatgpt.com";

  function createTabState(id, title = DEFAULT_CHAT_TITLE, url = DEFAULT_CHAT_URL) {
    const numericId = Number(id);
    const normalizedTitle = String(title || "").trim() || DEFAULT_CHAT_TITLE;

    return {
      id: numericId,
      title: normalizedTitle,
      url: normalizeTabUrl(url),
    };
  }

  function buildInitialTabState() {
    return {
      activeTabId: 1,
      tabs: [createTabState(1)],
    };
  }

  function normalizeTabUrl(url) {
    try {
      const rawUrl = String(url || "").trim();

      if (!/^https:\/\//i.test(rawUrl)) {
        return DEFAULT_CHAT_URL;
      }

      const normalizedUrl = new URL(rawUrl);

      if (normalizedUrl.protocol !== "https:" || normalizedUrl.hostname !== CHATGPT_HOSTNAME) {
        return DEFAULT_CHAT_URL;
      }

      return normalizedUrl.href;
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

    const activeTabId = tabs.some((tab) => tab.id === storedState?.activeTabId)
      ? Number(storedState.activeTabId)
      : tabs[0].id;

    return {
      activeTabId,
      tabs,
    };
  }

  const api = {
    DEFAULT_CHAT_URL,
    DEFAULT_CHAT_TITLE,
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
