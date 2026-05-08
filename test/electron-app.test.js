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
    "worker/package.json",
    "worker/wrangler.toml",
  ];

  removedPaths.forEach((removedPath) => {
    assert.equal(fs.existsSync(path.join(repoRoot, removedPath)), false, removedPath);
  });
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
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
  assert.match(makefile, /Export-PfxCertificate/);
  assert.match(makefile, /CSC_LINK=.*CSC_KEY_PASSWORD=.*npm run dist:win/);
});

test("renderer shell is a multitab UI without iframe-hosted ChatGPT pages", () => {
  const rendererHtml = readRepoFile("electron", "renderer.html");
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererHtml, /role="tablist"/);
  assert.match(rendererHtml, /class="tab-strip"/);
  assert.match(rendererSource, /function renderTabs/);
  assert.match(rendererSource, /chatgptTabs\.createTab/);
  assert.match(rendererSource, /chatgptTabs\.activateTab/);
  assert.doesNotMatch(rendererHtml, /<iframe/i);
  assert.doesNotMatch(rendererSource, /createElement\(['"]iframe['"]\)/);
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
