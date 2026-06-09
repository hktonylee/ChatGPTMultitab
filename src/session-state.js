(function attachSessionState(root) {
  const DEFAULT_CHAT_URL = "https://chatgpt.com/";
  const DEFAULT_CHAT_TITLE = "ChatGPT";
  const CHATGPT_HOSTNAME = "chatgpt.com";
  const CHATGPT_WWW_HOSTNAME = "www.chatgpt.com";

  function createTabState(id, title = DEFAULT_CHAT_TITLE, url = DEFAULT_CHAT_URL, options = {}) {
    const numericId = Number(id);
    const normalizedTitle = String(title || "").trim() || DEFAULT_CHAT_TITLE;
    const tabState = {
      id: numericId,
      title: normalizedTitle,
      url: normalizeTabUrl(url),
    };

    if (options.isUnloaded === true) {
      tabState.isUnloaded = true;
    }

    if (options.isStarred === true) {
      tabState.isStarred = true;
    }

    return tabState;
  }

  function buildInitialTabState() {
    return {
      activeTabId: 1,
      closedTabs: [],
      tabs: [createTabState(1)],
    };
  }

  function normalizeTabUrl(url) {
    try {
      let rawUrl = String(url || "").trim();

      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }

      if (!/^https:\/\//i.test(rawUrl)) {
        return DEFAULT_CHAT_URL;
      }

      const normalizedUrl = new URL(rawUrl);
      const hostname = normalizedUrl.hostname.toLowerCase();

      if (
        normalizedUrl.protocol !== "https:" ||
        (hostname !== CHATGPT_HOSTNAME && hostname !== CHATGPT_WWW_HOSTNAME)
      ) {
        return DEFAULT_CHAT_URL;
      }

      normalizedUrl.hostname = CHATGPT_HOSTNAME;
      return normalizedUrl.href;
    } catch (_error) {
      return DEFAULT_CHAT_URL;
    }
  }

  function isChatGptUrl(url) {
    return (
      normalizeTabUrl(url) !== DEFAULT_CHAT_URL ||
      /^(?:https?:\/\/)?(?:www\.)?chatgpt\.com\/?$/i.test(String(url || "").trim())
    );
  }

  function sanitizeStoredTabState(storedState) {
    const rawClosedTabs = Array.isArray(storedState?.closedTabs) ? storedState.closedTabs : [];
    const closedTabs = rawClosedTabs
      .map((tab) => {
        const id = Number(tab?.id);

        if (!Number.isInteger(id) || id < 1) {
          return null;
        }

        return createTabState(id, tab?.title, tab?.url);
      })
      .filter(Boolean);

    const rawTabs = Array.isArray(storedState?.tabs) ? storedState.tabs : [];
    const tabs = rawTabs
      .map((tab) => {
        const id = Number(tab?.id);

        if (!Number.isInteger(id) || id < 1) {
          return null;
        }

        return createTabState(id, tab?.title, tab?.url, {
          isUnloaded: tab?.isUnloaded === true,
          isStarred: tab?.isStarred === true,
        });
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
      closedTabs,
      tabs,
    };
  }

  const api = {
    DEFAULT_CHAT_URL,
    DEFAULT_CHAT_TITLE,
    buildInitialTabState,
    createTabState,
    isChatGptUrl,
    normalizeTabUrl,
    sanitizeStoredTabState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.SessionState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
