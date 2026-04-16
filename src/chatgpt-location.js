let lastReportedPayload = "";
let scheduledReport = 0;

function getCandidateChatUrls() {
  return [...document.querySelectorAll("a[href]")]
    .map((link) => link.getAttribute("href"))
    .filter(Boolean);
}

function reportLocationToParent() {
  const url = ChatGptUrl.extractPersistedChatUrl(window.location.href, getCandidateChatUrls());
  const title = String(document.title || "").trim();
  const payload = JSON.stringify({ url, title });

  if (!url || payload === lastReportedPayload) {
    return;
  }

  lastReportedPayload = payload;

  window.parent.postMessage(
    {
      source: "chatgpt-multitab",
      type: "chatgpt-location",
      url,
      title,
    },
    "*",
  );
}

function scheduleLocationReport() {
  if (scheduledReport) {
    return;
  }

  scheduledReport = window.setTimeout(() => {
    scheduledReport = 0;
    reportLocationToParent();
  }, 0);
}

function installHistoryReporter() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    scheduleLocationReport();
    return result;
  };

  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    scheduleLocationReport();
    return result;
  };
}

function installDomObserver() {
  const observer = new MutationObserver(() => {
    scheduleLocationReport();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
}

function postWorkspaceShortcutToParent(event) {
  if (window.parent === window) {
    return;
  }

  const action = KeyboardShortcuts.getWorkspaceShortcutAction(event);

  if (!action) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.parent.postMessage(
    {
      source: "chatgpt-multitab",
      type: "workspace-shortcut",
      action,
    },
    "*",
  );
}

function findAskAnythingInput() {
  const selectors = [
    'textarea[placeholder*="Ask anything" i]',
    'textarea[aria-label*="Ask anything" i]',
    '[contenteditable="true"][aria-label*="Ask anything" i]',
    '[contenteditable="true"][data-placeholder*="Ask anything" i]',
    '#prompt-textarea',
  ];

  for (const selector of selectors) {
    const input = document.querySelector(selector);

    if (input) {
      return input;
    }
  }

  return null;
}

function focusAskAnythingInput() {
  const input = findAskAnythingInput();

  if (!input) {
    return false;
  }

  input.focus({ preventScroll: false });
  input.click();
  return true;
}

function focusAskAnythingInputWithRetry(attempts = 8) {
  if (focusAskAnythingInput() || attempts <= 1) {
    return;
  }

  window.setTimeout(() => {
    focusAskAnythingInputWithRetry(attempts - 1);
  }, 150);
}

function handleWorkspaceMessage(event) {
  if (window.parent === window || event.source !== window.parent) {
    return;
  }

  if (event.data?.source !== "chatgpt-multitab" || event.data.type !== "focus-chat-prompt") {
    return;
  }

  focusAskAnythingInputWithRetry();
}

installHistoryReporter();
installDomObserver();

window.addEventListener("hashchange", scheduleLocationReport);
window.addEventListener("popstate", scheduleLocationReport);
window.addEventListener("load", scheduleLocationReport);
window.addEventListener("pageshow", scheduleLocationReport);
window.addEventListener("message", handleWorkspaceMessage);
document.addEventListener("visibilitychange", scheduleLocationReport);
document.addEventListener("keydown", postWorkspaceShortcutToParent);

scheduleLocationReport();
