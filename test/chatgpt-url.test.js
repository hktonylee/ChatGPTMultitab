const assert = require("node:assert/strict");
const test = require("node:test");

const { extractPersistedChatUrl } = require("../src/chatgpt-url");

test("keeps the current url when it already points at a chat conversation", () => {
  assert.equal(
    extractPersistedChatUrl(
      "https://chatgpt.com/c/69deaec1-0718-83e8-b8c4-1b83f1eab6f0",
      [
        "https://chatgpt.com/c/11111111-1111-1111-1111-111111111111",
      ],
    ),
    "https://chatgpt.com/c/69deaec1-0718-83e8-b8c4-1b83f1eab6f0",
  );
});

test("prefers a conversation url found in iframe content when the current url is generic", () => {
  assert.equal(
    extractPersistedChatUrl(
      "https://chatgpt.com/",
      [
        "/",
        "/c/69deaec1-0718-83e8-b8c4-1b83f1eab6f0",
        "https://example.com/c/not-chatgpt",
      ],
    ),
    "https://chatgpt.com/c/69deaec1-0718-83e8-b8c4-1b83f1eab6f0",
  );
});

test("falls back to the current iframe url when no conversation url exists in content", () => {
  assert.equal(
    extractPersistedChatUrl(
      "https://chatgpt.com/gpts",
      [
        "/gpts",
        "https://chatgpt.com/library",
      ],
    ),
    "https://chatgpt.com/gpts",
  );
});
