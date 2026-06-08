const tabCluster = document.querySelector(".tab-cluster");
const tabList = document.querySelector(".tab-list");
const newTabButton = document.querySelector(".new-tab");
const openExternalButton = document.querySelector(".open-external");

const NEW_TAB_MENU_HOLD_MS = 500;
const TAB_LIST_WHEEL_SCROLL_MULTIPLIER = 3;

let newTabMenuTimer = 0;
let didOpenNewTabMenu = false;

let currentState = {
  activeTabId: 1,
  closedTabs: [],
  tabs: [],
};

function updateTabOverflowIndicators() {
  const maxScrollLeft = tabList.scrollWidth - tabList.clientWidth;
  const hasOverflow = maxScrollLeft > 1;

  tabCluster.dataset.overflowLeft = String(hasOverflow && tabList.scrollLeft > 1);
  tabCluster.dataset.overflowRight = String(
    hasOverflow && tabList.scrollLeft < maxScrollLeft - 1,
  );
}

function renderTabs(state) {
  currentState = state;
  tabList.replaceChildren();

  state.tabs.forEach((tab) => {
    const tabButton = document.createElement("button");
    tabButton.className = "tab";
    tabButton.type = "button";
    tabButton.dataset.tabId = String(tab.id);
    tabButton.dataset.loadedState = tab.isUnloaded ? "unloaded" : "loaded";
    tabButton.id = `tab-${tab.id}`;
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute("aria-selected", String(tab.id === state.activeTabId));

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "ChatGPT";

    const closeButton = document.createElement("button");
    closeButton.className = "tab-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${title.textContent}`);
    closeButton.textContent = "×";

    tabButton.append(title, closeButton);
    tabList.append(tabButton);
  });

  tabList.querySelector(".tab[aria-selected=\"true\"]")?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
  updateTabOverflowIndicators();
}

function getTabIdFromEvent(event) {
  return Number(event.target.closest(".tab")?.dataset.tabId || 0);
}

function getAdjacentTabShortcutDirection(event) {
  if (event.key === "Tab") {
    return event.shiftKey ? -1 : 1;
  }

  if (!event.shiftKey) {
    return 0;
  }

  if (event.key === "[" || event.key === "{" || event.code === "BracketLeft") {
    return -1;
  }

  if (event.key === "]" || event.key === "}" || event.code === "BracketRight") {
    return 1;
  }

  return 0;
}

tabList.addEventListener("click", (event) => {
  const tabId = getTabIdFromEvent(event);

  if (!tabId) {
    return;
  }

  if (event.target.closest(".tab-close")) {
    event.stopPropagation();
    window.chatgptTabs.closeTab(tabId);
    return;
  }

  window.chatgptTabs.activateTab(tabId);
});

tabList.addEventListener("mousedown", (event) => {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
});

tabList.addEventListener("auxclick", (event) => {
  if (event.button !== 1) {
    return;
  }

  const tabId = getTabIdFromEvent(event);

  if (tabId) {
    event.preventDefault();
    window.chatgptTabs.closeTab(tabId);
  }
});

tabList.addEventListener("dblclick", (event) => {
  const tabId = getTabIdFromEvent(event);

  if (tabId) {
    event.preventDefault();
    window.chatgptTabs.closeTab(tabId);
  }
});

tabList.addEventListener(
  "wheel",
  (event) => {
    if (event.deltaY === 0 || tabList.scrollWidth <= tabList.clientWidth) {
      return;
    }

    event.preventDefault();
    tabList.scrollBy({
      left: event.deltaY * TAB_LIST_WHEEL_SCROLL_MULTIPLIER,
      behavior: "smooth",
    });
  },
  { passive: false },
);

tabList.addEventListener("scroll", updateTabOverflowIndicators);
window.addEventListener("resize", updateTabOverflowIndicators);

document.addEventListener("keydown", (event) => {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) {
    return;
  }

  if (event.ctrlKey && event.shiftKey && String(event.key || "").toLowerCase() === "p") {
    event.preventDefault();
    window.chatgptTabs.openSearch();
    return;
  }

  if (event.ctrlKey && event.code === "Backquote") {
    event.preventDefault();
    window.chatgptTabs.toggleSearch();
    return;
  }

  const direction = getAdjacentTabShortcutDirection(event);

  if (direction) {
    event.preventDefault();
    const tabs = currentState.tabs;
    const activeIndex = tabs.findIndex((tab) => tab.id === currentState.activeTabId);
    const nextTab = tabs[(activeIndex + direction + tabs.length) % tabs.length];

    if (nextTab) {
      window.chatgptTabs.activateTab(nextTab.id);
    }
  }
});

function clearNewTabMenuTimer() {
  if (!newTabMenuTimer) {
    return;
  }

  window.clearTimeout(newTabMenuTimer);
  newTabMenuTimer = 0;
}

newTabButton.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  didOpenNewTabMenu = false;
  clearNewTabMenuTimer();
  newTabMenuTimer = window.setTimeout(() => {
    newTabMenuTimer = 0;
    didOpenNewTabMenu = true;
    window.chatgptTabs.showNewTabMenu();
  }, NEW_TAB_MENU_HOLD_MS);
});

newTabButton.addEventListener("pointerup", clearNewTabMenuTimer);
newTabButton.addEventListener("pointercancel", clearNewTabMenuTimer);
newTabButton.addEventListener("pointerleave", clearNewTabMenuTimer);

newTabButton.addEventListener("click", (event) => {
  if (didOpenNewTabMenu) {
    event.preventDefault();
    didOpenNewTabMenu = false;
    return;
  }

  window.chatgptTabs.createTab();
});

openExternalButton.addEventListener("click", () => {
  window.chatgptTabs.openExternal();
});

window.chatgptTabs.onStateChange(renderTabs);
window.chatgptTabs.getState().then(renderTabs);
