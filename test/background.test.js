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

test("opens the options page when the clicked tab is already whitelisted", async () => {
  const calls = [];
  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          return {
            ...defaults,
            primaryUrl: "http://localhost:8080/",
            urlPatterns: ["http://localhost:8080/"],
          };
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

  await handleActionClick(chrome, { url: "http://localhost:8080/" });

  assert.deepEqual(calls, [["runtime.openOptionsPage"]]);
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

test("installs every rewrite as session rules only for whitelisted tabs", async () => {
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
        addRules: [],
        removeRuleIds: [100],
      },
    ],
    [
      "updateSessionRules",
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
              tabIds: [11],
            },
          },
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

test("clears every rewrite when no top-level tab matches the whitelist", async () => {
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
      async getAll() {
        return [{ name: "session", value: "abc" }];
      },
    },
    tabs: {
      async query() {
        return [{ id: 12, url: "https://untrusted.example/" }];
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
        return [{ id: 1 }, { id: 100 }];
      },
      async updateSessionRules(details) {
        calls.push(["updateSessionRules", details]);
      },
    },
  };

  const ruleCount = await refreshRules(chrome);

  assert.equal(ruleCount, 0);
  assert.deepEqual(calls, [
    ["updateDynamicRules", { addRules: [], removeRuleIds: [100] }],
    ["updateSessionRules", { addRules: [], removeRuleIds: [1, 100] }],
  ]);
});
