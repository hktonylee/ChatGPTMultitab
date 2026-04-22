const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildChatGptRequestHeaders,
  getWhitelistedTabIds,
  handleActionClick,
  registerFirefoxWebRequestFallback,
  refreshRules,
  removeChatGptFrameBlockingHeaders,
  removeRejectedChatGptSetCookieHeaders,
  shouldRegisterFirefoxWebRequestFallback,
} = require("../src/background");

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

test("removes frame-blocking response headers for firefox webrequest fallback", () => {
  assert.deepEqual(
    removeChatGptFrameBlockingHeaders([
      { name: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      { name: "X-Frame-Options", value: "DENY" },
      { name: "content-type", value: "text/html" },
      { name: "content-security-policy-report-only", value: "frame-ancestors 'none'" },
      { name: "Set-Cookie", value: "__Host-next-auth.csrf-token=csrf; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "__Secure-next-auth.callback-url=https%3A%2F%2Fchatgpt.com%2F; SameSite=Lax" },
      { name: "Set-Cookie", value: "oai-did=did; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "dd_cookie_test_2eed5109-ddc4-48b3-a0e3-9d6b41549c86=1; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "__Secure-next-auth.session-token=session; SameSite=None; Secure" },
    ]),
    [
      { name: "content-type", value: "text/html" },
      { name: "Set-Cookie", value: "__Secure-next-auth.session-token=session; SameSite=None; Secure" },
    ],
  );
});

test("does not register firefox webrequest fallback outside firefox", () => {
  assert.equal(shouldRegisterFirefoxWebRequestFallback({ webRequest: { onHeadersReceived: {} } }), false);
});

test("builds firefox chatgpt request headers with the forwarded session cookie", () => {
  assert.deepEqual(
    buildChatGptRequestHeaders(
      [
        { name: "Sec-Fetch-Site", value: "cross-site" },
        { name: "Origin", value: "https://workspace.example" },
        { name: "Cookie", value: "__Host-next-auth.csrf-token=csrf" },
        { name: "Accept", value: "text/html" },
      ],
      "__Secure-next-auth.session-token=session",
    ),
    [
      { name: "Accept", value: "text/html" },
      { name: "Cookie", value: "__Secure-next-auth.session-token=session" },
    ],
  );
});

test("firefox webrequest fallback listens to all chatgpt response types", () => {
  const previousBrowser = global.browser;
  const calls = [];

  global.browser = {
    runtime: {},
    webRequest: {
      onBeforeSendHeaders: {
        addListener(...args) {
          calls.push(["onBeforeSendHeaders", args]);
        },
      },
      onHeadersReceived: {
        addListener(...args) {
          calls.push(["onHeadersReceived", args]);
        },
      },
    },
  };

  try {
    registerFirefoxWebRequestFallback(global.browser);
  } finally {
    global.browser = previousBrowser;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "onBeforeSendHeaders");
  assert.deepEqual(calls[0][1][1], { urls: ["https://chatgpt.com/*", "https://*.chatgpt.com/*"] });
  assert.deepEqual(calls[0][1][2], ["blocking", "requestHeaders"]);
  assert.equal(calls[1][0], "onHeadersReceived");
  assert.deepEqual(calls[1][1][1], { urls: ["https://chatgpt.com/*", "https://*.chatgpt.com/*"] });
  assert.deepEqual(calls[1][1][2], ["blocking", "responseHeaders"]);
});

test("removes rejected set-cookie headers from chatgpt xhr responses", () => {
  assert.deepEqual(
    removeRejectedChatGptSetCookieHeaders([
      { name: "content-type", value: "application/json" },
      { name: "Set-Cookie", value: "__Host-next-auth.csrf-token=csrf; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "oai-did=did; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "dd_cookie_test_2eed5109-ddc4-48b3-a0e3-9d6b41549c86=1; SameSite=Lax; Secure; Path=/" },
      { name: "Set-Cookie", value: "__Secure-next-auth.session-token=session; SameSite=None; Secure" },
    ]),
    [
      { name: "content-type", value: "application/json" },
      { name: "Set-Cookie", value: "__Secure-next-auth.session-token=session; SameSite=None; Secure" },
    ],
  );
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
          return [{ name: "__Secure-next-auth.session-token", value: "abc" }];
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
                { header: "cookie", operation: "set", value: "__Secure-next-auth.session-token=abc" },
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

test("falls back to domain cookies when url cookies do not include a forwardable session", async () => {
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
          return [{ name: "__Host-next-auth.csrf-token", value: "csrf" }];
        }

        if (query.domain === "chatgpt.com") {
          return [{ name: "__Secure-next-auth.session-token", value: "session" }];
        }

        return [];
      },
    },
    tabs: {
      async query() {
        return [{ id: 11, url: "http://localhost:8080/" }];
      },
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return [];
      },
      async updateDynamicRules() {},
      async getSessionRules() {
        return [];
      },
      async updateSessionRules(details) {
        calls.push(details);
      },
    },
  };

  await refreshRules(chrome);

  const chatGptRule = calls[0].addRules.find((rule) => rule.id === 1);
  assert.deepEqual(
    chatGptRule.action.requestHeaders.find((header) => header.header === "cookie"),
    {
      header: "cookie",
      operation: "set",
      value: "__Secure-next-auth.session-token=session",
    },
  );
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
