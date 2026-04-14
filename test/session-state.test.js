const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_CHAT_URL,
  buildInitialTabState,
  createTabState,
  sanitizeStoredTabState,
} = require("../src/session-state");

test("creates a default tab state from a chat id", () => {
  assert.deepEqual(createTabState(3), {
    id: 3,
    title: "Chat 3",
    url: DEFAULT_CHAT_URL,
  });
});

test("builds the initial stored session state", () => {
  assert.deepEqual(buildInitialTabState(), {
    activeTabId: 1,
    nextChatId: 2,
    tabs: [
      {
        id: 1,
        title: "Chat 1",
        url: DEFAULT_CHAT_URL,
      },
    ],
  });
});

test("sanitizes stored tab session state", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 4,
      nextChatId: 2,
      tabs: [
        { id: 4, title: "  ", url: "https://chatgpt.com/c/abc" },
        { id: "bad", title: "Ignored", url: "https://example.com" },
        { id: 5, title: "Saved tab", url: "notaurl" },
      ],
    }),
    {
      activeTabId: 4,
      nextChatId: 6,
      tabs: [
        { id: 4, title: "Chat 4", url: "https://chatgpt.com/c/abc" },
        { id: 5, title: "Saved tab", url: DEFAULT_CHAT_URL },
      ],
    },
  );
});

test("falls back to a default session when stored state is unusable", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 99,
      nextChatId: 0,
      tabs: [],
    }),
    buildInitialTabState(),
  );
});
