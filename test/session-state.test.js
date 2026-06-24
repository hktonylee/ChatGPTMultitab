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
    title: "ChatGPT",
    url: DEFAULT_CHAT_URL,
  });
});

test("builds the initial stored session state", () => {
  assert.deepEqual(buildInitialTabState(), {
    activeTabId: 1,
    bookmarkedTabs: [],
    closedTabs: [],
    tabs: [
      {
        id: 1,
        title: "ChatGPT",
        url: DEFAULT_CHAT_URL,
      },
    ],
  });
});

test("sanitizes stored tab session state", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 4,
      bookmarkedTabs: [
        { title: "  Custom GPT  ", url: "https://chatgpt.com/g/g-abc-custom" },
        { title: "Ignored", url: "https://example.com/" },
      ],
      closedTabs: [
        { id: 8, title: "  ", url: "https://chatgpt.com/c/closed" },
        { id: "bad", title: "Ignored", url: "https://example.com" },
      ],
      tabs: [
        { id: 4, title: "  ", url: "https://chatgpt.com/c/abc" },
        { id: "bad", title: "Ignored", url: "https://example.com" },
        { id: 5, title: "Saved tab", url: "notaurl" },
      ],
    }),
    {
      activeTabId: 4,
      bookmarkedTabs: [
        { title: "Custom GPT", url: "https://chatgpt.com/g/g-abc-custom" },
        { title: "Ignored", url: DEFAULT_CHAT_URL },
      ],
      closedTabs: [
        { id: 8, title: "ChatGPT", url: "https://chatgpt.com/c/closed" },
      ],
      tabs: [
        { id: 4, title: "ChatGPT", url: "https://chatgpt.com/c/abc" },
        { id: 5, title: "Saved tab", url: DEFAULT_CHAT_URL },
      ],
    },
  );
});

test("preserves unloaded state for open tabs", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 4,
      tabs: [
        { id: 4, title: "Loaded", url: "https://chatgpt.com/c/loaded" },
        { id: 5, title: "Unloaded", url: "https://chatgpt.com/c/unloaded", isUnloaded: true },
        { id: 6, title: "False", url: "https://chatgpt.com/c/false", isUnloaded: false },
      ],
    }).tabs,
    [
      { id: 4, title: "Loaded", url: "https://chatgpt.com/c/loaded" },
      { id: 5, title: "Unloaded", url: "https://chatgpt.com/c/unloaded", isUnloaded: true },
      { id: 6, title: "False", url: "https://chatgpt.com/c/false" },
    ],
  );
});

test("preserves starred state for open tabs", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 4,
      tabs: [
        { id: 4, title: "Starred", url: "https://chatgpt.com/c/starred", isStarred: true },
        { id: 5, title: "False", url: "https://chatgpt.com/c/false", isStarred: false },
      ],
    }).tabs,
    [
      { id: 4, title: "Starred", url: "https://chatgpt.com/c/starred", isStarred: true },
      { id: 5, title: "False", url: "https://chatgpt.com/c/false" },
    ],
  );
});

test("falls back to an empty closed tab stack when stored closed tabs are unusable", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 6,
      closedTabs: [{ id: "bad", title: "Ignored", url: "https://example.com/" }],
      tabs: [
        { id: 6, title: "Saved tab", url: "https://chatgpt.com/c/open" },
      ],
    }).closedTabs,
    [],
  );
});

test("falls back to an empty bookmark list when stored bookmarks are unusable", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 6,
      bookmarkedTabs: [
        { title: "Missing URL" },
        "bad",
      ],
      tabs: [
        { id: 6, title: "Saved tab", url: "https://chatgpt.com/c/open" },
      ],
    }).bookmarkedTabs,
    [],
  );
});

test("normalizes relative or non-chatgpt urls back to the default chat url", () => {
  assert.equal(
    sanitizeStoredTabState({
      activeTabId: 6,
      tabs: [
        { id: 6, title: "Broken", url: "src/session-state.js" },
        { id: 7, title: "Other", url: "https://example.com/" },
      ],
    }).tabs[0].url,
    DEFAULT_CHAT_URL,
  );

  assert.equal(
    sanitizeStoredTabState({
      activeTabId: 7,
      tabs: [
        { id: 7, title: "Other", url: "https://example.com/" },
      ],
    }).tabs[0].url,
    DEFAULT_CHAT_URL,
  );
});

test("normalizes www and scheme-less ChatGPT urls to the canonical host", () => {
  assert.equal(createTabState(4, "Chat", "www.chatGPT.com").url, "https://chatgpt.com/");
  assert.equal(
    createTabState(5, "Chat", "https://www.chatGPT.com/c/abc?model=gpt-4o").url,
    "https://chatgpt.com/c/abc?model=gpt-4o",
  );
});

test("falls back to a default session when stored state is unusable", () => {
  assert.deepEqual(
    sanitizeStoredTabState({
      activeTabId: 99,
      tabs: [],
    }),
    buildInitialTabState(),
  );
});
