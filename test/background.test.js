const assert = require("node:assert/strict");
const test = require("node:test");

const { handleActionClick } = require("../src/background");

test("opens the primary page when one is configured", async () => {
  const calls = [];
  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, primaryUrl: "https://chatgpt.com/c/primary" };
        },
      },
    },
    tabs: {
      async create(details) {
        calls.push(["tabs.create", details]);
      },
    },
    runtime: {
      async openOptionsPage() {
        calls.push(["runtime.openOptionsPage"]);
      },
    },
  };

  await handleActionClick(chrome);

  assert.deepEqual(calls, [
    ["tabs.create", { url: "https://chatgpt.com/c/primary" }],
  ]);
});

test("falls back to the options page when no primary page is configured", async () => {
  const calls = [];
  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          return defaults;
        },
      },
    },
    tabs: {
      async create(details) {
        calls.push(["tabs.create", details]);
      },
    },
    runtime: {
      async openOptionsPage() {
        calls.push(["runtime.openOptionsPage"]);
      },
    },
  };

  await handleActionClick(chrome);

  assert.deepEqual(calls, [["runtime.openOptionsPage"]]);
});
