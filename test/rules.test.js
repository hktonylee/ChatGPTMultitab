const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildChatGptCookieHeader,
  buildChatGptIframeRequestHeaderRule,
  buildDynamicRules,
  buildHeaderRemovalRules,
  doesUrlMatchPattern,
  normalizePatterns,
} = require("../src/rules");

test("normalizes patterns by trimming blanks and removing duplicates", () => {
  assert.deepEqual(
    normalizePatterns([
      "  http://localhost:8080/  ",
      "",
      "http://localhost:8080/",
      "file:///home/tonylee/example.html",
    ]),
    ["http://localhost:8080/", "file:///home/tonylee/example.html"],
  );
});

test("builds dynamic rules that remove frame option response headers", () => {
  assert.deepEqual(buildHeaderRemovalRules(["http://localhost:8080/?tab=1"]), [
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
        regexFilter: "^http://localhost:8080/\\?tab=1$",
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
        { header: "content-security-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" },
      ],
    },
    condition: {
      urlFilter: "||chatgpt.com/",
      resourceTypes: ["sub_frame", "image", "xmlhttprequest", "media"],
    },
  });
});

test("builds a chatgpt.com iframe access rule with an injected cookie header", () => {
  assert.deepEqual(
    buildChatGptIframeRequestHeaderRule("a=1; b=two"),
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
          { header: "cookie", operation: "set", value: "a=1; b=two" },
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
      },
    },
  );
});

test("serializes chatgpt cookies into a request header value", () => {
  assert.equal(
    buildChatGptCookieHeader([
      { name: "__Secure-next-auth.session-token", value: "abc" },
      { name: "oai-did", value: "xyz" },
    ]),
    "__Secure-next-auth.session-token=abc; oai-did=xyz",
  );
  assert.equal(buildChatGptCookieHeader([]), "");
});

test("combines chatgpt iframe request cleanup with configured response header rules", () => {
  assert.deepEqual(
    buildDynamicRules(["https://chatgpt.com/*"]).map((rule) => rule.id),
    [1, 100],
  );
});

test("matches urls against stored patterns exactly", () => {
  assert.equal(
    doesUrlMatchPattern("https://chatgpt.com/c/123", "https://chatgpt.com/c/123"),
    true,
  );
  assert.equal(doesUrlMatchPattern("https://chatgpt.com/c/123", "https://chatgpt.com/*"), false);
  assert.equal(
    doesUrlMatchPattern("http://127.0.0.1:5173/app", "http://127.0.0.1:*/app"),
    false,
  );
  assert.equal(doesUrlMatchPattern("https://example.com/", "https://chatgpt.com/*"), false);
});
