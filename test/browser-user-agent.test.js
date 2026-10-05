const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const test = require("node:test");

const mainPath = path.join(__dirname, "..", "electron", "main.js");
const mainRequire = createRequire(mainPath);

function startupUserAgent(userAgent, appName) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "multitab-startup-test-"));
  const app = {
    userAgentFallback: userAgent,
    getName: () => appName,
    getPath: () => profile,
    setPath() {},
    requestSingleInstanceLock: () => false,
    on() {},
    quit() {},
  };
  try {
    vm.runInNewContext(fs.readFileSync(mainPath, "utf8"), {
      __dirname: path.dirname(mainPath), console,
      process: { platform: process.platform, argv: [] },
      require(name) {
        return name === "electron" ? { app, ipcMain: { handle() {}, on() {} } } : mainRequire(name);
      },
    });
    return app.userAgentFallback;
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

const suffix = "Chrome/148.0.7778.218 Safari/537.36";
const cases = [
  ["macOS packaged app", "ChatGPT Multitab", "ChatGPTMultitab", "Macintosh; Intel Mac OS X 10_15_7"],
  ["Windows packaged app", "ChatGPT Multitab", "ChatGPTMultitab", "Windows NT 10.0; Win64; x64"],
  ["Linux development app", "chatgpt-multitab", "chatgpt-multitab", "X11; Linux x86_64"],
  ["app name containing punctuation", "ChatGPT (Dev)+.App", "ChatGPT(Dev)+.App", "Macintosh; Intel Mac OS X 10_15_7"],
];
for (const [label, appName, product, platform] of cases) {
  test(`startup publishes browser identity for ${label}`, () => {
    const prefix = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko)`;
    const original = `${prefix} ${product}/1.0.0 Chrome/148.0.7778.218 Electron/42.3.2 Safari/537.36`;
    assert.equal(startupUserAgent(original, appName), `${prefix} ${suffix}`);
  });
}

test("startup preserves an existing browser user agent", () => {
  const browser = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ${suffix}`;
  assert.equal(startupUserAgent(browser, "ChatGPT Multitab"), browser);
});
