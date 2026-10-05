const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const electron = require("electron");
const { VisibleFixtureView } = require("./visible-fixture-view.cjs");

const { app, session, webContents } = electron;
const native = require(process.env.MULTITAB_NATIVE_TEST_ADDON);
const repoRoot = path.join(__dirname, "..");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "multitab-input-test-"));
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.on("window-all-closed", () => {});

const fixture = `<!doctype html><style>
  body { margin: 0; }
  nav { position: fixed; inset: 0 auto 0 0; width: 52px; }
  nav::before { content: ""; position: absolute; top: 0; left: 0; width: 52px; height: 180px;
    pointer-events: none; -webkit-app-region: drag !important; }
  button { display: block; width: 40px; height: 40px; margin: 12px 6px; }
</style><nav>
  <button id="home" style="-webkit-app-region: drag !important">Home</button>
  <button id="scheduled" style="-webkit-app-region: drag !important">Scheduled</button>
</nav><output id="selection"></output><script>
  for (const id of ['home', 'scheduled']) document.getElementById(id).onclick = () => {
    document.getElementById('selection').textContent = id;
  };
</script>`;

function loadShell() {
  const mainPath = path.join(repoRoot, "electron", "main.js");
  const mainRequire = createRequire(mainPath);
  return vm.runInNewContext(`${fs.readFileSync(mainPath, "utf8")}\n({
    createMainWindow, openTabSearch, closeTabSearch,
    getWindow: () => mainWindow, getController: () => tabController,
    getSearchView: () => tabSearchView,
  });`, {
    __dirname: path.dirname(mainPath), console, process,
    require(name) {
      if (name !== "electron") return mainRequire(name);
      return {
        ...electron,
        WebContentsView: VisibleFixtureView,
        app: {
          get userAgentFallback() { return app.userAgentFallback; },
          set userAgentFallback(value) { app.userAgentFallback = value; },
          getName: () => app.getName(),
          getPath: () => profile, getAppPath: () => repoRoot, setPath() {},
          requestSingleInstanceLock: () => false, on() {}, quit() {},
        },
        globalShortcut: { register: () => true, unregister() {} },
        systemPreferences: { getMediaAccessStatus: () => "granted" },
        shell: { openExternal() { throw new Error("Unexpected external navigation"); } },
      };
    },
  });
}

async function painted(contents) {
  contents.setBackgroundThrottling(false);
  if (contents.isLoading()) await new Promise(resolve => contents.once("did-finish-load", resolve));
  await contents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
}

async function click(window, view, id) {
  const rect = await view.webContents.executeJavaScript(`(() => {
    const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  const bounds = view.getBounds();
  const x = bounds.x + rect.x;
  const y = bounds.y + rect.y;
  assert.equal(native.hitTest(window.getNativeWindowHandle(), x, y), "RenderWidgetHostViewCocoa",
    `${id} must receive native clicks instead of dragging the window`);
  await view.webContents.executeJavaScript('document.getElementById("selection").textContent = ""');
  native.click(window.getNativeWindowHandle(), x, y);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (await view.webContents.executeJavaScript('document.getElementById("selection").textContent') === id) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(`${id} did not receive the Cocoa mouse click`);
}

const deadline = setTimeout(() => {
  console.error("Native input test timed out");
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  assert.equal(session.defaultSession.storagePath, profile);
  await session.defaultSession.protocol.handle("https", () => new Response(fixture, {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
  const shell = loadShell();
  shell.createMainWindow();
  const window = shell.getWindow();
  window.show();
  window.focus();
  await painted(window.webContents);
  const activeView = () => window.contentView.children.find(view =>
    view.webContents && view.webContents !== window.webContents && view !== shell.getSearchView());
  const check = async label => {
    const view = activeView();
    assert.ok(view, "ChatGPT view is attached");
    await painted(view.webContents);
    for (const id of ["home", "scheduled"]) await click(window, view, id);
    assert.equal(native.hitTest(window.getNativeWindowHandle(), 4, 50), "RenderWidgetHostViewCocoa",
      "sidebar pseudo-elements cannot turn background clicks into window drags");
    assert.equal(native.hitTest(window.getNativeWindowHandle(), 26, 36), "NativeWidgetMacNSWindowTitledFrame",
      "local tab strip keeps its native drag region");
    console.log(`PASS native Home/Scheduled clicks ${label}`);
  };
  await check("on first load");
  await activeView().webContents.reload();
  await check("after reload");
  shell.openTabSearch();
  await painted(shell.getSearchView().webContents);
  shell.closeTabSearch();
  await check("after search closes");
  for (let i = 0; i < 3; i++) {
    shell.getController().createTab(`https://chatgpt.com/c/local-${i}`);
    await check(`after tab switch ${i + 1}`);
  }
  window.setContentSize(700, 600);
  await check("at narrow width");
  for (const contents of webContents.getAllWebContents()) contents.close();
  window.destroy();
  clearTimeout(deadline);
  app.quit();
}).catch(error => {
  console.error(error);
  clearTimeout(deadline);
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
});
app.on("will-quit", () => fs.rmSync(profile, { recursive: true, force: true }));
