const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  shell,
} = require("electron");
const { createElectronTabController } = require("../src/electron-tabs");

const TOP_BAR_HEIGHT = 42;
const SESSION_FILE_NAME = "chatgpt-multitab-session.json";
const APP_ICON_FILE = "favicon-inverted.png";
const NEW_TAB_ARG = "--new-tab";

let mainWindow = null;
let tabController = null;
let pendingNewTabRequest = process.argv.includes(NEW_TAB_ARG);

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

function sendTabState(state) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("tabs:state", state);
  writeSessionState(state);
}

function shouldOpenNewTab(argv = []) {
  return argv.includes(NEW_TAB_ARG);
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

function openNewTabInMainWindow() {
  if (!tabController) {
    pendingNewTabRequest = true;
    focusMainWindow();
    return null;
  }

  focusMainWindow();
  return tabController.createTab();
}

function handleOpenRequest(argv) {
  if (!shouldOpenNewTab(argv)) {
    focusMainWindow();
    return null;
  }

  return openNewTabInMainWindow();
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "ChatGPT Multitab",
    backgroundColor: "#f7f7f7",
    autoHideMenuBar: true,
    icon: getAppIconPath(),
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
  });

  mainWindow.on("resize", () => {
    tabController.setBounds(getChatBounds(mainWindow));
  });

  mainWindow.on("maximize", () => {
    tabController.setBounds(getChatBounds(mainWindow));
  });

  mainWindow.on("focus", () => {
    tabController.focusActiveTab();
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    if (pendingNewTabRequest) {
      pendingNewTabRequest = false;
      openNewTabInMainWindow();
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
ipcMain.handle("tabs:close", (_event, id) => getController().closeTab(id)?.id || null);
ipcMain.handle("tabs:restoreClosed", () => getController().restoreClosedTab()?.id || null);
ipcMain.handle("tabs:openExternal", () => {
  const activeTab = getController().getActiveTab();

  if (activeTab?.url) {
    shell.openExternal(activeTab.url);
  }
});

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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
