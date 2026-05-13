const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("package starts the Electron app from the main process entrypoint", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));

  assert.equal(packageJson.main, "electron/main.js");
  assert.equal(packageJson.scripts.start, "electron .");
  assert.equal(packageJson.devDependencies.electron.startsWith("^"), true);
});

test("electron main process wraps ChatGPT pages in WebContentsView instances", () => {
  const mainSource = readRepoFile("electron", "main.js");
  const tabControllerSource = readRepoFile("src", "electron-tabs.js");

  assert.match(mainSource, /WebContentsView/);
  assert.match(mainSource, /new WebContentsView\(/);
  assert.match(tabControllerSource, /contentView\.addChildView/);
  assert.match(tabControllerSource, /tab\.view\.webContents\.loadURL\(tab\.url\)/);
  assert.doesNotMatch(mainSource, /BrowserView/);
  assert.doesNotMatch(mainSource, /<iframe/i);
});

test("electron main process configures permissions through the Electron session module", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /session\.defaultSession\.setPermissionRequestHandler/);
  assert.doesNotMatch(mainSource, /app\.session/);
});

test("electron main window hides the native menu bar", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /autoHideMenuBar:\s*true/);
  assert.match(mainSource, /mainWindow\.setMenuBarVisibility\(false\)/);
  assert.match(mainSource, /mainWindow\.setMenu\(null\)/);
});

test("electron app uses the inverted PNG logo", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const mainSource = readRepoFile("electron", "main.js");

  assert.equal(fs.existsSync(path.join(repoRoot, "favicon-inverted.png")), true);
  assert.match(mainSource, /const APP_ICON_FILE = "favicon-inverted\.png";/);
  assert.match(mainSource, /icon:\s*getAppIconPath\(\)/);
  assert.equal(packageJson.build.icon, "favicon-inverted.png");
  assert.equal(packageJson.build.files.includes("favicon-inverted.png"), true);
});

test("repo no longer ships Chrome extension or Worker build code", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const removedPaths = [
    "manifest.json",
    "options.html",
    "src/background.js",
    "src/options.js",
    "src/rules.js",
    "src/chatgpt-location.js",
    "src/chatgpt-url.js",
    "src/keyboard-shortcuts.js",
    "worker/.gitignore",
    "worker/package.json",
    "worker/wrangler.toml",
  ];

  removedPaths.forEach((removedPath) => {
    assert.equal(fs.existsSync(path.join(repoRoot, removedPath)), false, removedPath);
  });
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
  assert.equal(fs.existsSync(path.join(repoRoot, "worker")), false);
  assert.equal(
    packageJson.scripts.check,
    "node --check src/session-state.js && node --check src/electron-tabs.js && node --check electron/main.js && node --check electron/preload.js && node --check electron/renderer.js",
  );
});

test("Makefile can create a Windows code-signing certificate", () => {
  const makefile = readRepoFile("Makefile");

  assert.match(makefile, /\.PHONY: windows-code-sign-cert/);
  assert.match(makefile, /New-SelfSignedCertificate/);
  assert.match(makefile, /-Type CodeSigningCert/);
  assert.match(makefile, /RandomNumberGenerator/);
  assert.match(makefile, /Export-PfxCertificate/);
  assert.match(makefile, /CSC_LINK=.*CSC_KEY_PASSWORD=.*npm run dist:win/);
});

test("Makefile can sign a Windows executable with the generated certificate", () => {
  const makefile = readRepoFile("Makefile");

  assert.match(makefile, /\.PHONY: windows-sign-exe/);
  assert.match(makefile, /WINDOWS_SIGN_EXE \?=/);
  assert.match(makefile, /Get-ChildItem 'dist' -Recurse -Filter '\*\.exe'/);
  assert.match(makefile, /signtool\.exe/);
  assert.match(makefile, /Set-AuthenticodeSignature/);
  assert.match(makefile, /Cert:\\CurrentUser\\My/);
  assert.match(makefile, /SignerCertificate/);
  assert.match(makefile, /Export-PfxCertificate/);
  assert.match(makefile, /\/f/);
  assert.match(makefile, /\/p/);
  assert.match(makefile, /'\/fd', 'SHA256'/);
  assert.match(makefile, /'\/td', 'SHA256'/);
});

test("renderer shell is a multitab UI without iframe-hosted ChatGPT pages", () => {
  const rendererHtml = readRepoFile("electron", "renderer.html");
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererHtml, /role="tablist"/);
  assert.match(rendererHtml, /class="tab-strip"/);
  assert.match(
    rendererHtml,
    /<div class="tab-cluster">\s*<div class="tab-list"><\/div>\s*<button class="toolbar-button new-tab"/,
  );
  assert.match(rendererHtml, /<div class="tab-actions">/);
  assert.match(rendererSource, /function renderTabs/);
  assert.match(rendererSource, /chatgptTabs\.createTab/);
  assert.match(rendererSource, /chatgptTabs\.activateTab/);
  assert.doesNotMatch(rendererHtml, /<iframe/i);
  assert.doesNotMatch(rendererSource, /createElement\(['"]iframe['"]\)/);
});

test("renderer leaves new and close shortcuts to the managed chat webContents", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.doesNotMatch(rendererSource, /String\(event\.key\)\.toLowerCase\(\) === "t"/);
  assert.doesNotMatch(rendererSource, /String\(event\.key\)\.toLowerCase\(\) === "w"/);
  assert.doesNotMatch(rendererSource, /window\.chatgptTabs\.closeTab\(currentState\.activeTabId\)/);
  assert.match(rendererSource, /event\.key === "Tab"/);
});

test("electron main process does not handle tab shortcuts a second time", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.doesNotMatch(mainSource, /function handleTabShortcut/);
  assert.doesNotMatch(mainSource, /mainWindow\.webContents\.on\("before-input-event"/);
  assert.doesNotMatch(mainSource, /getController\(\)\.closeTab\(getController\(\)\.getActiveTab\(\)\?\.id\)/);
  assert.doesNotMatch(mainSource, /getController\(\)\.getActiveTab\(\)\?\.view\.webContents\.reload\?\.\(\)/);
});

test("electron main process does not register duplicate global tab shortcuts", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.doesNotMatch(mainSource, /globalShortcut/);
  assert.doesNotMatch(mainSource, /CommandOrControl\+T/);
  assert.doesNotMatch(mainSource, /CommandOrControl\+W/);
  assert.doesNotMatch(mainSource, /registerFocusedWindowShortcuts/);
  assert.doesNotMatch(mainSource, /unregisterFocusedWindowShortcuts/);
});

test("renderer closes a tab on double click", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererSource, /tabList\.addEventListener\("dblclick"/);
  assert.match(rendererSource, /event\.preventDefault\(\);/);
  assert.match(rendererSource, /window\.chatgptTabs\.closeTab\(tabId\);/);
});

test("electron tab controller attaches only the active WebContentsView", () => {
  const {
    createElectronTabController,
    DEFAULT_CONTENT_BOUNDS,
    DEFAULT_CHAT_URL,
  } = require("../src/electron-tabs");

  const attachedViews = [];
  const contentView = {
    addChildView(view) {
      attachedViews.push(view);
    },
    removeChildView(view) {
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
  };

  const createdUrls = [];
  function createView() {
    return {
      bounds: null,
      setBounds(bounds) {
        this.bounds = bounds;
      },
      webContents: {
        loadURL(url) {
          createdUrls.push(url);
        },
        on() {},
      },
    };
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    initialBounds: DEFAULT_CONTENT_BOUNDS,
  });

  const firstTabId = controller.getState().tabs[0].id;
  const firstView = attachedViews[0];
  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  assert.equal(createdUrls[0], DEFAULT_CHAT_URL);
  assert.equal(createdUrls[1], "https://chatgpt.com/c/second");
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], secondTab.view);
  assert.deepEqual(secondTab.view.bounds, DEFAULT_CONTENT_BOUNDS);

  controller.activateTab(firstTabId);

  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], firstView);
});

test("electron tab controller focuses the visible WebContentsView when the active tab changes", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };
  const focusedViews = [];

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {
          focusedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();

  assert.equal(focusedViews.at(-1), firstTab.view);

  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  assert.equal(focusedViews.at(-1), secondTab.view);

  controller.activateTab(firstTab.id);

  assert.equal(focusedViews.at(-1), firstTab.view);

  controller.closeTab(firstTab.id);

  assert.equal(focusedViews.at(-1), secondTab.view);
});

test("electron tab controller replaces the last closed tab with a new default tab", () => {
  const { createElectronTabController, DEFAULT_CHAT_URL } = require("../src/electron-tabs");

  const attachedViews = [];
  const closedViews = [];
  const loadedUrls = [];
  const contentView = {
    addChildView(view) {
      attachedViews.push(view);
    },
    removeChildView(view) {
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
  };

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        close() {
          closedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const closedTab = controller.getActiveTab();
  const result = controller.closeTab(closedTab.id);
  const state = controller.getState();

  assert.equal(result.id, closedTab.id);
  assert.equal(closedViews[0], closedTab.view);
  assert.deepEqual(state.closedTabs, [
    {
      id: closedTab.id,
      title: "ChatGPT",
      url: DEFAULT_CHAT_URL,
    },
  ]);
  assert.equal(state.tabs.length, 1);
  assert.equal(state.tabs[0].id, closedTab.id + 1);
  assert.equal(state.activeTabId, state.tabs[0].id);
  assert.equal(loadedUrls.at(-1), DEFAULT_CHAT_URL);
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], controller.getActiveTab().view);
});

test("electron tab controller handles webContents shortcuts before window defaults", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  let reloadCount = 0;
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        reload() {
          reloadCount += 1;
        },
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");

  let newTabPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        newTabPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "T",
    },
  );

  assert.equal(newTabPrevented, true);
  assert.equal(controller.getState().tabs.length, 3);
  assert.equal(controller.getState().activeTabId, 3);

  let prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "w",
    },
  );

  assert.equal(prevented, true);
  assert.equal(controller.getState().tabs.length, 2);
  assert.equal(controller.getState().activeTabId, 2);

  let nextNewTabPrevented = false;
  beforeInputHandlers[1](
    {
      preventDefault() {
        nextNewTabPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "t",
    },
  );

  assert.equal(nextNewTabPrevented, true);
  assert.equal(controller.getState().tabs.length, 3);
  assert.equal(controller.getState().activeTabId, 3);

  let reloadPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        reloadPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "r",
    },
  );

  assert.equal(reloadPrevented, true);
  assert.equal(reloadCount, 1);
  assert.equal(controller.getState().tabs.length, 3);
});

test("electron tab controller ignores shortcut key-up events", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        reload() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  let newTabPrevented = false;

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        newTabPrevented = true;
      },
    },
    {
      type: "keyUp",
      alt: false,
      control: true,
      meta: false,
      key: "t",
    },
  );

  assert.equal(newTabPrevented, false);
  assert.equal(controller.getState().tabs.length, 1);

  let closeTabPrevented = false;

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        closeTabPrevented = true;
      },
    },
    {
      type: "keyUp",
      alt: false,
      control: true,
      meta: false,
      key: "w",
    },
  );

  assert.equal(closeTabPrevented, false);
  assert.equal(controller.getState().tabs.length, 1);
  assert.equal(controller.getState().closedTabs.length, 0);
});
