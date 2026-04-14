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

installHistoryReporter();
installDomObserver();

window.addEventListener("hashchange", scheduleLocationReport);
window.addEventListener("popstate", scheduleLocationReport);
window.addEventListener("load", scheduleLocationReport);
window.addEventListener("pageshow", scheduleLocationReport);
document.addEventListener("visibilitychange", scheduleLocationReport);

scheduleLocationReport();
