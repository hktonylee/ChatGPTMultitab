const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { configureStableAppDataPaths } = require("../src/app-data-paths");

test("uses a stable Windows directory for configuration and session state", (context) => {
  const appDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "chatgpt-multitab-app-data-"));
  const configuredPaths = [];
  context.after(() => fs.rmSync(appDataPath, { force: true, recursive: true }));

  const stableDataPath = configureStableAppDataPaths(
    {
      getPath(name) {
        assert.equal(name, "appData");
        return appDataPath;
      },
      setPath(name, value) {
        configuredPaths.push([name, value]);
      },
    },
    "win32",
  );

  const expectedPath = path.join(appDataPath, "ChatGPT Multitab");
  assert.equal(stableDataPath, expectedPath);
  assert.equal(fs.statSync(expectedPath).isDirectory(), true);
  assert.deepEqual(configuredPaths, [
    ["userData", expectedPath],
    ["sessionData", expectedPath],
  ]);
});

test("leaves Electron data paths unchanged outside Windows", () => {
  const app = {
    getPath() {
      assert.fail("non-Windows platforms must keep Electron's default paths");
    },
    setPath() {
      assert.fail("non-Windows platforms must keep Electron's default paths");
    },
  };

  assert.equal(configureStableAppDataPaths(app, "darwin"), null);
});
