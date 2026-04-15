const assert = require("node:assert/strict");
const test = require("node:test");

const { getWhitelistedTabIds, handleActionClick, refreshRules } = require("../src/background");

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

test("finds only tabs whose top-level url exactly matches the whitelist", async () => {
  const chrome = {
    tabs: {
      async query(queryInfo) {
        assert.deepEqual(queryInfo, {});
        return [
          { id: 3, url: "http://localhost:8080/" },
          { id: 4, url: "http://localhost:8080/other" },
          { id: 5, url: "https://example.com/" },
          { id: undefined, url: "http://localhost:8080/" },
        ];
      },
    },
  };

  assert.deepEqual(await getWhitelistedTabIds(["http://localhost:8080/"], chrome), [3]);
});

test("installs chatgpt cookie rewrite as a session rule only for whitelisted tabs", async () => {
  const calls = [];
  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, urlPatterns: ["http://localhost:8080/"] };
        },
      },
    },
    cookies: {
      async getAll(query) {
        if (query.url === "https://chatgpt.com/") {
          return [{ name: "session", value: "abc" }];
        }

        return [];
      },
    },
    tabs: {
      async query() {
        return [
          { id: 11, url: "http://localhost:8080/" },
          { id: 12, url: "https://untrusted.example/" },
        ];
      },
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return [{ id: 100 }];
      },
      async updateDynamicRules(details) {
        calls.push(["updateDynamicRules", details]);
      },
      async getSessionRules() {
        return [{ id: 1 }];
      },
      async updateSessionRules(details) {
        calls.push(["updateSessionRules", details]);
      },
    },
  };

  const ruleCount = await refreshRules(chrome);

  assert.equal(ruleCount, 2);
  assert.deepEqual(calls, [
    [
      "updateDynamicRules",
      {
        addRules: [
          {
            id: 100,
            priority: 1,
            action: {
              type: "modifyHeaders",
              responseHeaders: [
                { header: "x-frame-options", operation: "remove" },
                { header: "frame-options", operation: "remove" },
              ],
            },
            condition: {
              regexFilter: "^http://localhost:8080/$",
              resourceTypes: ["main_frame", "sub_frame"],
            },
          },
        ],
        removeRuleIds: [100],
      },
    ],
    [
      "updateSessionRules",
      {
        addRules: [
          {
            id: 1,
            priority: 2,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                { header: "sec-fetch-dest", operation: "remove" },
                { header: "sec-fetch-mode", operation: "remove" },
                { header: "sec-fetch-site", operation: "remove" },
                { header: "sec-fetch-user", operation: "remove" },
                { header: "referer", operation: "remove" },
                { header: "origin", operation: "remove" },
                { header: "cookie", operation: "set", value: "session=abc" },
              ],
              responseHeaders: [
                { header: "x-frame-options", operation: "remove" },
                { header: "frame-options", operation: "remove" },
                { header: "content-security-policy", operation: "remove" },
                { header: "content-security-policy-report-only", operation: "remove" },
              ],
            },
            condition: {
              urlFilter: "||chatgpt.com/",
              resourceTypes: ["sub_frame", "image", "xmlhttprequest", "media"],
              tabIds: [11],
            },
          },
        ],
        removeRuleIds: [1],
      },
    ],
  ]);
});
