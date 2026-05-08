const { DEFAULT_CHAT_URL, DEFAULT_CHAT_TITLE, createTabState, sanitizeStoredTabState } =
  require("./session-state");

const DEFAULT_CONTENT_BOUNDS = Object.freeze({
  x: 0,
  y: 42,
  width: 1200,
  height: 758,
});

function serializeTab(tab) {
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
  };
}

function normalizeBounds(bounds) {
  return {
    x: Math.max(0, Number(bounds?.x) || 0),
    y: Math.max(0, Number(bounds?.y) || 0),
    width: Math.max(1, Number(bounds?.width) || DEFAULT_CONTENT_BOUNDS.width),
    height: Math.max(1, Number(bounds?.height) || DEFAULT_CONTENT_BOUNDS.height),
  };
}

function createElectronTabController({
  contentView,
  createView,
  initialState,
  initialBounds = DEFAULT_CONTENT_BOUNDS,
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

  function emitStateChange() {
    onStateChange(controller.getState());
  }

  function updateNextTabId() {
    nextTabId = tabs.reduce((maxId, tab) => Math.max(maxId, tab.id), 0) + 1;
  }

  function attachView(tab) {
    if (!tab || attachedView === tab.view) {
      return;
    }

    if (attachedView) {
      contentView.removeChildView(attachedView);
    }

    tab.view.setBounds(bounds);
    contentView.addChildView(tab.view);
    tab.view.webContents.focus?.();
    attachedView = tab.view;
  }

  function handleTabShortcut(tab, event, input) {
    if (input?.alt || !(input?.control || input?.meta)) {
      return;
    }

    const key = String(input?.key || "").toLowerCase();

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

  function createManagedTab(tabState) {
    const tab = {
      id: tabState.id,
      title: tabState.title || DEFAULT_CHAT_TITLE,
      url: tabState.url || DEFAULT_CHAT_URL,
      view: createView(),
    };

    if (typeof tab.view.webContents?.loadURL !== "function") {
      throw new TypeError("created view must expose webContents.loadURL");
    }

    tab.view.webContents.loadURL(tab.url);
    tab.view.webContents.on?.("page-title-updated", (_event, title) => {
      controller.updateTab(tab.id, { title });
    });
    tab.view.webContents.on?.("did-navigate", (_event, url) => {
      controller.updateTab(tab.id, { url });
    });
    tab.view.webContents.on?.("did-navigate-in-page", (_event, url) => {
      controller.updateTab(tab.id, { url });
    });
    tab.view.webContents.on?.("before-input-event", (event, input) => {
      handleTabShortcut(tab, event, input);
    });

    return tab;
  }

  function createDefaultTab() {
    return createManagedTab(createTabState(nextTabId, DEFAULT_CHAT_TITLE, DEFAULT_CHAT_URL));
  }

  function loadInitialState(state) {
    const session = sanitizeStoredTabState(state);
    closedTabs = session.closedTabs;
    activeTabId = session.activeTabId;
    session.tabs.forEach((tabState) => tabs.push(createManagedTab(tabState)));
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

      if (attachedView === tab.view) {
        contentView.removeChildView(tab.view);
        attachedView = null;
      }

      tab.view.webContents?.close?.();

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

      const tab = createManagedTab(tabState);
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
      tabs.find((tab) => tab.id === activeTabId)?.view.setBounds(bounds);
    },

    getActiveTab() {
      return tabs.find((tab) => tab.id === activeTabId) || null;
    },
  };

  loadInitialState(initialState);
  return controller;
}

module.exports = {
  DEFAULT_CHAT_URL,
  DEFAULT_CONTENT_BOUNDS,
  createElectronTabController,
};
