const backdrop = document.querySelector(".tab-search-backdrop");
const input = document.querySelector(".tab-search-input");
const results = document.querySelector(".tab-search-results");

let currentState = {
  activeTabId: 1,
  closedTabs: [],
  tabs: [],
};
let selectedIndex = 0;
let shouldFocusInputAfterRender = false;

function getMatchingTabs() {
  const query = input.value.trim().toLocaleLowerCase();

  return currentState.tabs.filter((tab) => {
    const title = tab.title || "ChatGPT";
    return title.toLocaleLowerCase().includes(query);
  });
}

function getActiveTabIndex(tabs) {
  const activeIndex = tabs.findIndex((tab) => tab.id === currentState.activeTabId);

  return Math.max(0, activeIndex);
}

function getTabDisplayTitle(tab) {
  const title = tab.title || "ChatGPT";

  return `${tab.isStarred ? "⭐ " : ""}${title}`;
}

function activateTab(tabId) {
  window.chatgptTabs.activateTab(tabId).then(() => window.chatgptTabs.closeSearch());
}

function focusInputAfterRender() {
  requestAnimationFrame(() => input.focus());
}

async function closeTabFromSearch(tabId) {
  shouldFocusInputAfterRender = true;
  await window.chatgptTabs.closeTab(tabId);
}

function renderResults({ resetSelection = false } = {}) {
  const tabs = getMatchingTabs();

  if (resetSelection) {
    selectedIndex = getActiveTabIndex(tabs);
  } else {
    selectedIndex = Math.min(selectedIndex, Math.max(0, tabs.length - 1));
  }

  results.replaceChildren();

  if (tabs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tab-search-empty";
    empty.textContent = "No matching tabs";
    results.append(empty);
    return;
  }

  tabs.forEach((tab, index) => {
    const title = tab.title || "ChatGPT";
    const displayTitle = getTabDisplayTitle(tab);
    const row = document.createElement("div");
    row.className = "tab-search-row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(index === selectedIndex));

    const selectButton = document.createElement("button");
    selectButton.className = "tab-search-select";
    selectButton.type = "button";
    selectButton.textContent = displayTitle;
    selectButton.title = displayTitle;
    selectButton.addEventListener("click", () => activateTab(tab.id));

    const closeButton = document.createElement("button");
    closeButton.className = "tab-search-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", `Close ${displayTitle}`);
    closeButton.addEventListener("click", () => closeTabFromSearch(tab.id));

    row.append(selectButton, closeButton);
    results.append(row);
  });

  results.querySelector('[aria-selected="true"]')?.scrollIntoView({
    block: "nearest",
  });
}

function moveSelection(direction) {
  const tabs = getMatchingTabs();

  if (tabs.length === 0) {
    return;
  }

  selectedIndex = (selectedIndex + direction + tabs.length) % tabs.length;
  renderResults();
}

function closeSelectedTab() {
  const tab = getMatchingTabs()[selectedIndex];

  if (tab) {
    closeTabFromSearch(tab.id);
  }
}

function isCursorAfterSearchText() {
  return input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
}

function isCloseSelectedTabShortcut(event) {
  if (event.ctrlKey && event.key === "Delete") {
    return true;
  }

  return window.chatgptTabs.platform === "darwin" && event.metaKey && event.key === "Backspace";
}

input.addEventListener("input", () => renderResults({ resetSelection: true }));

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.code === "Backquote") {
    event.preventDefault();
    window.chatgptTabs.closeSearch();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    window.chatgptTabs.closeSearch();
  }
});

input.addEventListener("keydown", (event) => {
  if (isCloseSelectedTabShortcut(event)) {
    event.preventDefault();
    closeSelectedTab();
    return;
  }

  if (event.key === "Delete" && isCursorAfterSearchText() && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    closeSelectedTab();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const tab = getMatchingTabs()[selectedIndex];

    if (tab) {
      activateTab(tab.id);
    }
    return;
  }
});

backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) {
    window.chatgptTabs.closeSearch();
  }
});

window.chatgptTabs.onStateChange((state) => {
  currentState = state;
  renderResults();

  if (shouldFocusInputAfterRender) {
    shouldFocusInputAfterRender = false;
    focusInputAfterRender();
  }
});

window.chatgptTabs.onSearchOpened((state) => {
  currentState = state;
  input.value = "";
  renderResults({ resetSelection: true });
  requestAnimationFrame(() => input.focus());
});

window.chatgptTabs.getState().then((state) => {
  currentState = state;
  renderResults({ resetSelection: true });
});
