const tabCluster = document.querySelector(".tab-cluster");
const tabList = document.querySelector(".tab-list");
const newTabButton = document.querySelector(".new-tab");
const restoreTabButton = document.querySelector(".restore-tab");
const openExternalButton = document.querySelector(".open-external");

const TAB_LIST_WHEEL_SCROLL_MULTIPLIER = 3;

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

  restoreTabButton.disabled = state.closedTabs.length === 0;
}

function getTabIdFromEvent(event) {
  return Number(event.target.closest(".tab")?.dataset.tabId || 0);
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

  if (event.key === "Tab") {
    event.preventDefault();
    const tabs = currentState.tabs;
    const activeIndex = tabs.findIndex((tab) => tab.id === currentState.activeTabId);
    const direction = event.shiftKey ? -1 : 1;
    const nextTab = tabs[(activeIndex + direction + tabs.length) % tabs.length];

    if (nextTab) {
      window.chatgptTabs.activateTab(nextTab.id);
    }
  }
});

newTabButton.addEventListener("click", () => {
  window.chatgptTabs.createTab();
});

restoreTabButton.addEventListener("click", () => {
  window.chatgptTabs.restoreClosedTab();
});

openExternalButton.addEventListener("click", () => {
  window.chatgptTabs.openExternal();
});

window.chatgptTabs.onStateChange(renderTabs);
window.chatgptTabs.getState().then(renderTabs);
