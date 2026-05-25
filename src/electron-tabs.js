const { DEFAULT_CHAT_URL, DEFAULT_CHAT_TITLE, createTabState, sanitizeStoredTabState } =
  require("./session-state");

const DEFAULT_CONTENT_BOUNDS = Object.freeze({
  x: 0,
  y: 42,
  width: 1200,
  height: 758,
});
const INITIAL_LOADED_TAB_LIMIT = 3;
const INACTIVE_UNLOAD_DELAY_MS = 30 * 60 * 1000;
const INACTIVE_UNLOAD_CHECK_INTERVAL_MS = 60 * 1000;

function serializeTab(tab) {
  const tabState = {
    id: tab.id,
    title: tab.title,
    url: tab.url,
  };

  if (tab.isUnloaded === true) {
    tabState.isUnloaded = true;
  }

  return tabState;
}

function normalizeBounds(bounds) {
  return {
    x: Math.max(0, Number(bounds?.x) || 0),
    y: Math.max(0, Number(bounds?.y) || 0),
    width: Math.max(1, Number(bounds?.width) || DEFAULT_CONTENT_BOUNDS.width),
    height: Math.max(1, Number(bounds?.height) || DEFAULT_CONTENT_BOUNDS.height),
  };
}

function isMainChatUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const defaultUrl = new URL(DEFAULT_CHAT_URL);

    return parsedUrl.origin === defaultUrl.origin && parsedUrl.pathname === "/";
  } catch (_error) {
    return false;
  }
}

function createElectronTabController({
  contentView,
  createView,
  initialState,
  initialBounds = DEFAULT_CONTENT_BOUNDS,
  inactiveUnloadDelayMs = INACTIVE_UNLOAD_DELAY_MS,
  inactiveUnloadCheckIntervalMs = INACTIVE_UNLOAD_CHECK_INTERVAL_MS,
  now = () => Date.now(),
  setIntervalFn = setInterval,
  onStateChange = () => {},
} = {}) {
  if (!contentView || typeof contentView.addChildView !== "function") {
    throw new TypeError("contentView with addChildView is required");
  }

  if (typeof createView !== "function") {
    throw new TypeError("createView is required");
  }

  let bounds = normalizeBounds(initialBounds);
  let attachedView = null;
  let closedTabs = [];
  let activeTabId = 1;
  let nextTabId = 1;
  const tabs = [];

  function getInitiallyLoadedTabIds(tabStates, activeId) {
    const loadedTabIds = new Set();
    const activeTab = tabStates.find((tab) => tab.id === activeId);

    if (activeTab) {
      loadedTabIds.add(activeTab.id);
    }

    for (let index = tabStates.length - 1; index >= 0; index -= 1) {
      if (loadedTabIds.size >= INITIAL_LOADED_TAB_LIMIT) {
        break;
      }

      loadedTabIds.add(tabStates[index].id);
    }

    return loadedTabIds;
  }

  function emitStateChange() {
    onStateChange(controller.getState());
  }

  function updateNextTabId() {
    nextTabId = tabs.reduce((maxId, tab) => Math.max(maxId, tab.id), 0) + 1;
  }

  function attachView(tab) {
    if (!tab) {
      return;
    }

    const view = ensureTabLoaded(tab);
    tab.lastActiveAt = now();

    if (attachedView === view) {
      return;
    }

    if (attachedView) {
      contentView.removeChildView(attachedView);
    }

    view.setBounds(bounds);
    contentView.addChildView(view);
    view.webContents.focus?.();
    attachedView = view;
  }

  function activateAdjacentTab(direction) {
    const activeIndex = tabs.findIndex((item) => item.id === activeTabId);

    if (activeIndex < 0 || tabs.length < 2) {
      return null;
    }

    const nextIndex = (activeIndex + direction + tabs.length) % tabs.length;
    return controller.activateTab(tabs[nextIndex].id);
  }

  function handleTabShortcut(tab, event, input) {
    if (input?.type && input.type !== "keyDown") {
      return;
    }

    if (input?.alt || !(input?.control || input?.meta)) {
      return;
    }

    const key = String(input?.key || "").toLowerCase();
    const code = String(input?.code || "").toLowerCase();

    if (key === "tab" || code === "tab") {
      event.preventDefault();
      activateAdjacentTab(input?.shift ? -1 : 1);
      return;
    }

    if (key === "t" && input?.shift) {
      event.preventDefault();
      controller.restoreClosedTab();
      return;
    }

    if (key === "t") {
      event.preventDefault();
      controller.createTab();
      return;
    }

    if (key === "w") {
      event.preventDefault();
      controller.closeTab(tab.id);
      return;
    }

    if (key === "r") {
      event.preventDefault();
      tab.view.webContents.reload?.();
    }
  }

  function createTabView(tab) {
    const view = createView();

    if (typeof view.webContents?.loadURL !== "function") {
      throw new TypeError("created view must expose webContents.loadURL");
    }

    view.webContents.loadURL(tab.url);
    view.webContents.on?.("page-title-updated", (_event, title) => {
      const normalizedTitle = typeof title === "string" ? title.trim() : "";

      if (tab.isWaitingForRestoredTitle && normalizedTitle === DEFAULT_CHAT_TITLE) {
        return;
      }

      tab.isWaitingForRestoredTitle = false;
      controller.updateTab(tab.id, { title: normalizedTitle });
    });
    view.webContents.on?.("did-navigate", (_event, url) => {
      controller.updateTab(tab.id, { url });
    });
    view.webContents.on?.("did-navigate-in-page", (_event, url) => {
      controller.updateTab(tab.id, { url });
    });
    view.webContents.on?.("before-input-event", (event, input) => {
      handleTabShortcut(tab, event, input);
    });

    return view;
  }

  function ensureTabLoaded(tab) {
    if (!tab.view) {
      tab.isWaitingForRestoredTitle = tab.isWaitingForRestoredTitle || tab.isUnloaded === true;
      tab.view = createTabView(tab);
      tab.isUnloaded = false;
    }

    return tab.view;
  }

  function createManagedTab(tabState, options = {}) {
    const shouldLoad = options.load !== false;
    const tab = {
      id: tabState.id,
      title: tabState.title || DEFAULT_CHAT_TITLE,
      url: tabState.url || DEFAULT_CHAT_URL,
      view: null,
      isUnloaded: !shouldLoad,
      isWaitingForRestoredTitle: options.waitForRestoredTitle === true,
      lastActiveAt: now(),
    };

    if (shouldLoad) {
      ensureTabLoaded(tab);
    }

    return tab;
  }

  function unloadInactiveTabs() {
    const currentTime = now();
    let unloadedAnyTab = false;

    tabs.forEach((tab) => {
      if (tab.id === activeTabId || !tab.view || tab.isUnloaded === true) {
        return;
      }

      if (currentTime - tab.lastActiveAt < inactiveUnloadDelayMs) {
        return;
      }

      if (attachedView === tab.view) {
        contentView.removeChildView(tab.view);
        attachedView = null;
      }

      tab.view.webContents.close?.();
      tab.view = null;
      tab.isUnloaded = true;
      unloadedAnyTab = true;
    });

    if (unloadedAnyTab) {
      emitStateChange();
    }
  }

  function createDefaultTab() {
    return createManagedTab(createTabState(nextTabId, DEFAULT_CHAT_TITLE, DEFAULT_CHAT_URL));
  }

  function loadInitialState(state) {
    const session = sanitizeStoredTabState(state);
    const initiallyLoadedTabIds = getInitiallyLoadedTabIds(session.tabs, session.activeTabId);
    closedTabs = session.closedTabs;
    activeTabId = session.activeTabId;
    session.tabs.forEach((tabState) => {
      tabs.push(
        createManagedTab(tabState, {
          load: initiallyLoadedTabIds.has(tabState.id),
        }),
      );
    });
    updateNextTabId();
    attachView(tabs.find((tab) => tab.id === activeTabId) || tabs[0]);
  }

  const controller = {
    getState() {
      return {
        activeTabId,
        closedTabs,
        tabs: tabs.map(serializeTab),
      };
    },

    createTab(url = DEFAULT_CHAT_URL) {
      const tab = createManagedTab(createTabState(nextTabId, DEFAULT_CHAT_TITLE, url));
      tabs.push(tab);
      updateNextTabId();
      activeTabId = tab.id;
      attachView(tab);
      emitStateChange();
      return tab;
    },

    createTabForNewTabRequest() {
      const activeTab = controller.getActiveTab();

      if (isMainChatUrl(activeTab?.url)) {
        controller.focusActiveTab();
        return activeTab;
      }

      return controller.createTab();
    },

    activateTab(id) {
      const tab = tabs.find((item) => item.id === Number(id));

      if (!tab) {
        return null;
      }

      activeTabId = tab.id;
      attachView(tab);
      emitStateChange();
      return tab;
    },

    closeTab(id) {
      const index = tabs.findIndex((tab) => tab.id === Number(id));

      if (index < 0) {
        return null;
      }

      const [tab] = tabs.splice(index, 1);
      closedTabs.push(serializeTab(tab));

      if (tab.view && attachedView === tab.view) {
        contentView.removeChildView(tab.view);
        attachedView = null;
      }

      tab.view?.webContents?.close?.();

      if (activeTabId === tab.id) {
        let nextTab = tabs[index] || tabs[index - 1] || tabs[0];

        if (!nextTab) {
          nextTab = createDefaultTab();
          tabs.push(nextTab);
        }

        activeTabId = nextTab.id;
        attachView(nextTab);
      }

      updateNextTabId();
      emitStateChange();
      return tab;
    },

    restoreClosedTab() {
      const tabState = closedTabs.pop();

      if (!tabState) {
        emitStateChange();
        return null;
      }

      const tab = createManagedTab(tabState, { waitForRestoredTitle: true });
      tabs.push(tab);
      updateNextTabId();
      activeTabId = tab.id;
      attachView(tab);
      emitStateChange();
      return tab;
    },

    updateTab(id, updates) {
      const tab = tabs.find((item) => item.id === Number(id));

      if (!tab) {
        return null;
      }

      if (typeof updates?.title === "string" && updates.title.trim()) {
        tab.title = updates.title.trim();
      }

      if (typeof updates?.url === "string" && updates.url.trim()) {
        tab.url = updates.url;
      }

      emitStateChange();
      return tab;
    },

    setBounds(nextBounds) {
      bounds = normalizeBounds(nextBounds);
      tabs.find((tab) => tab.id === activeTabId)?.view?.setBounds(bounds);
    },

    focusActiveTab() {
      const tab = tabs.find((item) => item.id === activeTabId);

      if (!tab) {
        return null;
      }

      ensureTabLoaded(tab).webContents.focus?.();
      return tab;
    },

    getActiveTab() {
      return tabs.find((tab) => tab.id === activeTabId) || null;
    },
  };

  loadInitialState(initialState);
  const inactivityInterval = setIntervalFn(unloadInactiveTabs, inactiveUnloadCheckIntervalMs);
  inactivityInterval?.unref?.();
  return controller;
}

module.exports = {
  DEFAULT_CHAT_URL,
  DEFAULT_CONTENT_BOUNDS,
  INACTIVE_UNLOAD_DELAY_MS,
  createElectronTabController,
};
