const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "multitab-native-test-"));
const env = { ...process.env };

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", timeout: 60000 });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exitCode = result.status || 1;
  return result.status === 0;
}

try {
  if (process.platform === "darwin") {
    const headers = path.resolve(path.dirname(fs.realpathSync(process.execPath)), "..", "include", "node");
    if (!fs.existsSync(path.join(headers, "node_api.h"))) {
      throw new Error(`Node headers missing at ${headers}`);
    }
    env.MULTITAB_NATIVE_TEST_ADDON = path.join(buildDir, "native-hit-test.node");
    if (!run("xcrun", [
      "clang", "-shared", "-fPIC", "-fobjc-arc", "-DNAPI_VERSION=8", `-I${headers}`,
      "-framework", "Cocoa", "-undefined", "dynamic_lookup",
      "-o", env.MULTITAB_NATIVE_TEST_ADDON, path.join(__dirname, "native-hit-test.m"),
    ])) throw new Error("Native test helper compilation failed");
  }
  const electron = require("electron");
  const flags = process.argv.slice(2);
  if (process.platform === "darwin") flags.push("--use-mock-keychain");
  if (run(electron, [...flags, path.join(__dirname, "chat-page-navigation.electron.cjs")]) &&
      process.platform === "darwin") {
    run(electron, [...flags, path.join(__dirname, "chat-page-input.electron.cjs")]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
