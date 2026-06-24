const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  WebContentsView,
  ipcMain,
  session,
  shell,
} = require("electron");
const { createElectronTabController } = require("../src/electron-tabs");
const { isChatGptUrl, normalizeTabUrl } = require("../src/session-state");

const TOP_BAR_HEIGHT = 42;
const SESSION_FILE_NAME = "chatgpt-multitab-session.json";
const APP_ICON_FILE = "favicon-inverted.png";
const NEW_TAB_ARG = "--new-tab";
const IS_MACOS = process.platform === "darwin";
const NEW_TAB_SHORTCUTS = Object.freeze([IS_MACOS ? "Command+Shift+C" : "Super+C"]);

let mainWindow = null;
let tabController = null;
let tabSearchView = null;
let isTabSearchOpen = false;
let pendingNewTabUrl = getChatGptUrlArg(process.argv);
let pendingNewTabRequest = process.argv.includes(NEW_TAB_ARG) || Boolean(pendingNewTabUrl);

function getSessionFilePath() {
  return path.join(app.getPath("userData"), SESSION_FILE_NAME);
}

function getAppIconPath() {
  return path.join(app.getAppPath(), APP_ICON_FILE);
}

function readSessionState() {
  try {
    return JSON.parse(fs.readFileSync(getSessionFilePath(), "utf8"));
  } catch (_error) {
    return null;
  }
}

function writeSessionState(state) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(getSessionFilePath(), `${JSON.stringify(state, null, 2)}\n`);
}

function getChatBounds(window) {
  const [width, height] = window.getContentSize();

  return {
    x: 0,
    y: TOP_BAR_HEIGHT,
    width,
    height: Math.max(1, height - TOP_BAR_HEIGHT),
  };
}

function getTabSearchBounds(window) {
  const [width, height] = window.getContentSize();

  return {
    x: 0,
    y: TOP_BAR_HEIGHT,
    width,
    height: Math.max(1, height - TOP_BAR_HEIGHT),
  };
}

function sendTabState(state) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("tabs:state", state);
  tabSearchView?.webContents.send("tabs:state", state);
  writeSessionState(state);
}

function closeTabSearch() {
  if (!isTabSearchOpen) {
    return false;
  }

  isTabSearchOpen = false;
  tabSearchView?.setVisible(false);
  tabController?.focusActiveTab();
  return true;
}

function focusTabSearchView() {
  if (!isTabSearchOpen || !tabSearchView) {
    return;
  }

  tabSearchView.webContents.focus();
}

function openTabSearchView() {
  if (!isTabSearchOpen || !tabSearchView) {
    return;
  }

  tabSearchView.webContents.send("tabs:searchOpened", getController().getState());
  focusTabSearchView();
}

function toggleTabSearch() {
  if (!mainWindow || mainWindow.isDestroyed() || !tabSearchView) {
    return false;
  }

  if (isTabSearchOpen) {
    return closeTabSearch();
  }

  return openTabSearch();
}

function openTabSearch() {
  if (!mainWindow || mainWindow.isDestroyed() || !tabSearchView) {
    return false;
  }

  if (isTabSearchOpen) {
    focusTabSearchView();
    return true;
  }

  isTabSearchOpen = true;
  tabSearchView.setBounds(getTabSearchBounds(mainWindow));
  mainWindow.contentView.addChildView(tabSearchView);
  tabSearchView.setVisible(true);

  if (tabSearchView.webContents.isLoading()) {
    tabSearchView.webContents.once("did-finish-load", openTabSearchView);
  } else {
    openTabSearchView();
  }

  return true;
}

function keepTabSearchOnTop() {
  if (isTabSearchOpen && mainWindow && tabSearchView) {
    mainWindow.contentView.addChildView(tabSearchView);
    tabSearchView.webContents.focus();
  }
}

function shouldOpenNewTab(argv = []) {
  return argv.includes(NEW_TAB_ARG);
}

function getChatGptUrlArg(argv = []) {
  for (const arg of argv) {
    if (isChatGptUrl(arg)) {
      return normalizeTabUrl(arg);
    }
  }

  return null;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  return true;
}

function openNewTabInMainWindow(url) {
  if (!tabController) {
    pendingNewTabRequest = true;
    pendingNewTabUrl = url || pendingNewTabUrl;
    focusMainWindow();
    return null;
  }

  focusMainWindow();
  return tabController.createTabForNewTabRequest(url);
}

function handleOpenRequest(argv) {
  const url = getChatGptUrlArg(argv);

  if (url) {
    return openNewTabInMainWindow(url);
  }

  if (!shouldOpenNewTab(argv)) {
    focusMainWindow();
    return null;
  }

  return openNewTabInMainWindow();
}

function registerNewTabShortcuts() {
  NEW_TAB_SHORTCUTS.forEach((shortcut) => {
    const registered = globalShortcut.register(shortcut, () => {
      openNewTabInMainWindow();
    });

    if (!registered) {
      console.warn(`Failed to register global shortcut ${shortcut}`);
    }
  });
}

function installApplicationMenu() {
  if (!IS_MACOS) {
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          {
            label: "Command Palette",
            accelerator: "Command+Shift+P",
            click: () => openTabSearch(),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
    ]),
  );
}

function showNewTabMenu() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  const bookmarkedTabs = getController().getState().bookmarkedTabs;
  const menu = Menu.buildFromTemplate([
    {
      label: "Open a new tab",
      click: () => getController().createTab(),
    },
    {
      label: "Re-open the closed tab",
      enabled: getController().getState().closedTabs.length > 0,
      click: () => getController().restoreClosedTab(),
    },
    ...(bookmarkedTabs.length > 0
      ? [
          {
            type: "separator",
          },
          ...bookmarkedTabs.map((bookmark) => ({
            label: bookmark.title,
            click: () => getController().openBookmarkedTab(bookmark.url),
          })),
        ]
      : []),
  ]);

  menu.popup({ window: mainWindow });
  return true;
}

function confirmCloseTabs(window, { title, detail, confirmLabel, onConfirm }) {
  dialog
    .showMessageBox(window, {
      type: "warning",
      title,
      message: title,
      detail,
      buttons: ["Cancel", confirmLabel],
      defaultId: 0,
      cancelId: 0,
    })
    .then(({ response }) => {
      if (response === 1) {
        onConfirm();
      }
    });
}

function showTabContextMenu(event, id) {
  const controller = getController();
  const tabId = Number(id);
  const state = controller.getState();
  const tabIndex = state.tabs.findIndex((item) => item.id === tabId);
  const tab = state.tabs[tabIndex];

  if (!tab) {
    return false;
  }

  const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const leftTabCount = state.tabs.slice(0, tabIndex).filter((item) => !item.isStarred).length;
  const allTabCount = state.tabs.filter((item) => !item.isStarred).length;
  const menu = Menu.buildFromTemplate([
    {
      label: tab.isStarred ? "Unstar this tab" : "Star this tab",
      click: () => controller.toggleTabStar(tabId),
    },
    {
      label: controller.isTabBookmarked(tabId) ? "Un-bookmark this tab" : "Bookmark this tab",
      click: () => controller.toggleTabBookmark(tabId),
    },
    {
      type: "separator",
    },
    {
      label: "Reload the page",
      click: () => controller.reloadTab(tabId),
    },
    {
      label: "Open the tab in external browser",
      click: () => shell.openExternal(tab.url),
    },
    {
      type: "separator",
    },
    {
      label: "Close this tab",
      click: () => controller.closeTab(tabId, { force: true }),
    },
    {
      label: "Close all tabs on the left",
      enabled: leftTabCount > 0,
      click: () =>
        confirmCloseTabs(window, {
          title: "Close all tabs on the left?",
          detail: `${leftTabCount} tab${leftTabCount === 1 ? "" : "s"} will close.`,
          confirmLabel: "Close tabs",
          onConfirm: () => controller.closeTabsToLeft(tabId),
        }),
    },
    {
      label: "Close all tabs",
      enabled: allTabCount > 0,
      click: () =>
        confirmCloseTabs(window, {
          title: "Close all tabs?",
          detail: `${allTabCount} tab${allTabCount === 1 ? "" : "s"} will close.`,
          confirmLabel: "Close tabs",
          onConfirm: () => controller.closeAllTabs(),
        }),
    },
  ]);

  menu.popup({ window });
  return true;
}

function createChatView() {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return view;
}

function createTabSearchView() {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  view.setBackgroundColor("#00000000");
  view.setVisible(false);
  view.webContents.loadFile(path.join(__dirname, "tab-search.html"));
  return view;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "ChatGPT Multitab",
    backgroundColor: "#f7f7f7",
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    ...(IS_MACOS
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  tabController = createElectronTabController({
    contentView: mainWindow.contentView,
    createView: createChatView,
    initialBounds: getChatBounds(mainWindow),
    initialState: readSessionState(),
    onStateChange: sendTabState,
    onOpenTabSearch: openTabSearch,
    onToggleTabSearch: toggleTabSearch,
  });
  tabSearchView = createTabSearchView();
  tabSearchView.setBounds(getTabSearchBounds(mainWindow));
  mainWindow.contentView.addChildView(tabSearchView);
  installApplicationMenu();

  mainWindow.on("resize", () => {
    tabController.setBounds(getChatBounds(mainWindow));
    tabSearchView.setBounds(getTabSearchBounds(mainWindow));
  });

  mainWindow.on("maximize", () => {
    tabController.setBounds(getChatBounds(mainWindow));
    tabSearchView.setBounds(getTabSearchBounds(mainWindow));
  });

  mainWindow.on("focus", () => {
    if (isTabSearchOpen) {
      focusTabSearchView();
    } else {
      tabController.focusActiveTab();
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    if (pendingNewTabRequest) {
      pendingNewTabRequest = false;
      const url = pendingNewTabUrl;
      pendingNewTabUrl = null;
      openNewTabInMainWindow(url);
      return;
    }

    sendTabState(tabController.getState());
  });
}

function getController() {
  if (!tabController) {
    throw new Error("Tab controller is not ready");
  }

  return tabController;
}

ipcMain.handle("tabs:getState", () => getController().getState());
ipcMain.handle("tabs:create", (_event, url) => getController().createTab(url).id);
ipcMain.handle("tabs:activate", (_event, id) => getController().activateTab(id)?.id || null);
ipcMain.handle("tabs:close", (_event, id) => {
  const closedTabId = getController().closeTab(id)?.id || null;
  keepTabSearchOnTop();
  return closedTabId;
});
ipcMain.handle("tabs:restoreClosed", () => getController().restoreClosedTab()?.id || null);
ipcMain.handle("tabs:showNewTabMenu", showNewTabMenu);
ipcMain.handle("tabs:toggleSearch", toggleTabSearch);
ipcMain.handle("tabs:openSearch", openTabSearch);
ipcMain.handle("tabs:closeSearch", closeTabSearch);
ipcMain.on("tabs:showContextMenu", showTabContextMenu);

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    handleOpenRequest(argv);
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(["camera", "clipboard-sanitized-write", "geolocation", "media"].includes(permission));
    });

    createMainWindow();
    registerNewTabShortcuts();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on("will-quit", () => {
  NEW_TAB_SHORTCUTS.forEach((shortcut) => globalShortcut.unregister(shortcut));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
