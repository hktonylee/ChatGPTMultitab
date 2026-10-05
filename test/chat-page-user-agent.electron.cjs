const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const electron = require("electron");

const { app, session, webContents } = electron;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "multitab-ua-test-"));
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.setName("ChatGPT Multitab");
app.on("window-all-closed", () => {});

const requests = [];
const server = http.createServer((request, response) => {
  requests.push({ url: request.url, userAgent: request.headers["user-agent"] });
  if (request.url.startsWith("/backend-api/automations")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ userAgent: request.headers["user-agent"] }));
  } else {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Local browser identity fixture</title>");
  }
});

function loadChatViewFactory() {
  const mainPath = path.join(__dirname, "..", "electron", "main.js");
  const mainRequire = createRequire(mainPath);
  return vm.runInNewContext(`${fs.readFileSync(mainPath, "utf8")}\ncreateChatView;`, {
    __dirname: path.dirname(mainPath), console, process,
    require(name) {
      if (name !== "electron") return mainRequire(name);
      return {
        ...electron,
        app: {
          get userAgentFallback() { return app.userAgentFallback; },
          set userAgentFallback(value) { app.userAgentFallback = value; },
          getName: () => app.getName(),
          getPath: () => profile, setPath() {},
          requestSingleInstanceLock: () => false, on() {}, quit() {},
        },
      };
    },
  });
}

async function check(view, label, expectedUserAgent) {
  const identity = await view.webContents.executeJavaScript(`(async () => {
    const api = await fetch('/backend-api/automations?filter=scheduled&limit=100').then(response => response.json());
    const workerAgent = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob(['postMessage(navigator.userAgent)'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const close = () => { worker.terminate(); URL.revokeObjectURL(url); };
      worker.onmessage = event => { close(); resolve(event.data); };
      worker.onerror = event => { close(); reject(new Error(event.message)); };
    });
    return { page: navigator.userAgent, api: api.userAgent, worker: workerAgent };
  })()`);
  assert.equal(identity.page, expectedUserAgent, `${label}: page browser identity`);
  assert.equal(identity.api, expectedUserAgent, `${label}: Scheduled fetch browser identity`);
  assert.equal(identity.worker, expectedUserAgent, `${label}: worker browser identity`);
  assert.ok(requests.some(request => request.url === "/" && request.userAgent === expectedUserAgent),
    `${label}: navigation browser identity`);
  console.log(`PASS browser identity ${label}`);
}

const deadline = setTimeout(() => {
  console.error("Browser identity test timed out");
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  assert.equal(session.defaultSession.storagePath, profile);
  const original = app.userAgentFallback;
  const expectedUserAgent = original.replace(/ ChatGPTMultitab\/\S+| Electron\/\S+/g, "");
  assert.ok(expectedUserAgent.includes(`Chrome/${process.versions.chrome}`), "keep actual Chromium version");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/`;
  const createView = loadChatViewFactory();
  let view = createView();
  await view.webContents.loadURL(url);
  await check(view, "on first load", expectedUserAgent);
  requests.length = 0;
  await new Promise(resolve => {
    view.webContents.once("did-finish-load", resolve);
    view.webContents.reload();
  });
  await check(view, "after reload", expectedUserAgent);
  for (const label of ["in new view", "after view recreation"]) {
    view.webContents.close();
    requests.length = 0;
    view = createView();
    await view.webContents.loadURL(url);
    await check(view, label, expectedUserAgent);
  }
  for (const contents of webContents.getAllWebContents()) contents.close();
  await new Promise(resolve => server.close(resolve));
  clearTimeout(deadline);
  app.quit();
}).catch(error => {
  console.error(error);
  clearTimeout(deadline);
  server.closeAllConnections();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
});
app.on("will-quit", () => fs.rmSync(profile, { recursive: true, force: true }));
