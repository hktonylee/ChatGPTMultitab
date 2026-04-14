const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildChatGptIframeRequestHeaderRule,
  buildDynamicRules,
  buildHeaderRemovalRules,
  doesUrlMatchPattern,
  normalizePatterns,
} = require("../src/rules");

test("normalizes patterns by trimming blanks and removing duplicates", () => {
  assert.deepEqual(
    normalizePatterns([
      "  http://localhost:8080/*  ",
      "",
      "http://localhost:8080/*",
      "file:///home/tonylee/example.html",
    ]),
    ["http://localhost:8080/*", "file:///home/tonylee/example.html"],
  );
});

test("builds dynamic rules that remove frame option response headers", () => {
  assert.deepEqual(buildHeaderRemovalRules(["http://localhost:8080/*"]), [
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
        urlFilter: "http://localhost:8080/*",
        resourceTypes: ["main_frame", "sub_frame"],
      },
    },
  ]);
});

test("builds a chatgpt.com iframe access rule", () => {
  assert.deepEqual(buildChatGptIframeRequestHeaderRule(), {
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
      ],
      responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "frame-options", operation: "remove" },
      ],
    },
    condition: {
      urlFilter: "||chatgpt.com/",
      resourceTypes: ["sub_frame"],
    },
  });
});

test("combines chatgpt iframe request cleanup with configured response header rules", () => {
  assert.deepEqual(
    buildDynamicRules(["https://chatgpt.com/*"]).map((rule) => rule.id),
    [1, 100],
  );
});

test("matches urls against stored wildcard patterns", () => {
  assert.equal(doesUrlMatchPattern("https://chatgpt.com/c/123", "https://chatgpt.com/*"), true);
  assert.equal(
    doesUrlMatchPattern("http://127.0.0.1:5173/app", "http://127.0.0.1:*/app"),
    true,
  );
  assert.equal(doesUrlMatchPattern("https://example.com/", "https://chatgpt.com/*"), false);
});
