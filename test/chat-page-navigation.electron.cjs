const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const electron = require("electron");
const { VisibleFixtureView } = require("./visible-fixture-view.cjs");

const { app, BrowserWindow, session } = electron;
const repoRoot = path.join(__dirname, "..");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "multitab-navigation-test-"));
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.on("window-all-closed", () => {});

// Evaluate the production view factory without starting the app, registering
// global shortcuts, or opening the user's persisted tabs.
function loadCreateChatView() {
  const mainPath = path.join(repoRoot, "electron", "main.js");
  const mainRequire = createRequire(mainPath);
  return vm.runInNewContext(`${fs.readFileSync(mainPath, "utf8")}\ncreateChatView;`, {
    __dirname: path.dirname(mainPath),
    console,
    process,
    require(name) {
      if (name !== "electron") {
        return mainRequire(name);
      }
      return {
        ...electron,
        WebContentsView: VisibleFixtureView,
        app: {
          get userAgentFallback() { return app.userAgentFallback; },
          set userAgentFallback(value) { app.userAgentFallback = value; },
          getName: () => app.getName(),
          getPath: () => profile,
          setPath() {},
          requestSingleInstanceLock: () => false,
          quit() {},
          on() {},
        },
        ipcMain: { handle() {}, on() {} },
      };
    },
  });
}

const fixture = `<!doctype html>
<meta charset="utf-8">
<style>
  body { margin: 0; }
  #sidebar { position: absolute; left: 12px; top: 24px; width: 40px; height: 40px; anchor-name: --sidebar; }
  #account { position: absolute; right: 12px; top: 24px; width: 40px; height: 40px; anchor-name: --account; }
  [popover] { position: fixed; inset: auto; margin: 0; width: 180px; padding: 8px; }
  #sidebar-menu { position-anchor: --sidebar; left: anchor(right); top: anchor(top); }
  #account-menu { position-anchor: --account; right: anchor(left); top: anchor(top); }
  [popover] button { display: block; width: 100%; height: 32px; }
</style>
<button id="sidebar" popovertarget="sidebar-menu">Space</button>
<button id="account" popovertarget="account-menu">More</button>
<div id="sidebar-menu" popover="manual"><button id="pages">All pages</button></div>
<div id="account-menu" popover="manual"><button id="settings">Settings</button></div>
<output id="selection"></output>
<script>
  for (const id of ["pages", "settings"]) {
    document.getElementById(id).addEventListener("click", () => {
      document.getElementById("selection").textContent = id;
    });
  }
</script>`;

async function bounds(contents, id) {
  return contents.executeJavaScript(`(() => {
    const rect = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`);
}

async function click(contents, rect) {
  const position = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  await contents.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...position });
  await contents.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...position });
}

async function checkNavigation(createChatView, width, triggerId, itemId) {
  const window = new BrowserWindow({ show: false, width, height: 600 });
  const view = createChatView();
  try {
    window.webContents.setBackgroundThrottling(false);
    view.webContents.setBackgroundThrottling(false);
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 42, width, height: 558 });
    await view.webContents.loadURL("https://chatgpt.com/");
    window.show();
    window.focus();
    await view.webContents.executeJavaScript("new Promise(requestAnimationFrame)");
    view.webContents.debugger.attach("1.3");
    const trigger = await bounds(view.webContents, triggerId);
    await click(view.webContents, trigger);
    const menu = await bounds(view.webContents, `${triggerId}-menu`);
    assert.ok(menu.width > 0, `${triggerId} click opens its menu`);
    assert.ok(menu.x >= 0 && menu.x + menu.width <= width, `${triggerId} menu stays within ${width}px viewport`);
    if (triggerId === "sidebar") {
      assert.equal(menu.x, trigger.x + trigger.width, "sidebar menu stays beside its trigger");
    } else {
      assert.equal(menu.x + menu.width, trigger.x, "account menu stays beside its trigger");
    }
    await click(view.webContents, await bounds(view.webContents, itemId));
    assert.equal(await view.webContents.executeJavaScript('document.getElementById("selection").textContent'), itemId);
    console.log(`PASS ${triggerId} menu position and click at ${width}px`);
  } finally {
    view.webContents.close();
    window.destroy();
  }
}

const deadline = setTimeout(() => {
  console.error("Electron navigation test timed out");
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  assert.equal(session.defaultSession.storagePath, profile, "browser session uses the temporary profile");
  // Intercept HTTPS in this empty profile. The test never contacts ChatGPT.
  await session.defaultSession.protocol.handle("https", () => new Response(fixture, {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
  const createChatView = loadCreateChatView();
  for (const width of [1280, 360]) {
    await checkNavigation(createChatView, width, "sidebar", "pages");
    await checkNavigation(createChatView, width, "account", "settings");
  }
  clearTimeout(deadline);
  app.quit();
}).catch(error => {
  console.error(error);
  clearTimeout(deadline);
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
});

app.on("will-quit", () => fs.rmSync(profile, { recursive: true, force: true }));
