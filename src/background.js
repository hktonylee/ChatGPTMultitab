if (typeof importScripts === "function") {
  importScripts("rules.js");
}

if (typeof require === "function" && typeof XfoRuleBuilder === "undefined") {
  globalThis.XfoRuleBuilder = require("./rules");
}

const STORAGE_KEY = "urlPatterns";
const PRIMARY_STORAGE_KEY = "primaryUrl";
const CHATGPT_COOKIE_URL = "https://chatgpt.com/";
const CHATGPT_COOKIE_DOMAIN = "chatgpt.com";
const CHATGPT_WEBREQUEST_URLS = ["https://chatgpt.com/*", "https://*.chatgpt.com/*"];
const CHATGPT_REQUEST_HEADERS_TO_REMOVE = new Set([
  "origin",
  "referer",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
]);
const CHATGPT_FRAME_RESPONSE_HEADERS_TO_REMOVE = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "frame-options",
  "x-frame-options",
]);
const CHATGPT_SESSION_SET_COOKIE_PATTERN = /^(?:__Secure-)?next-auth\.session-token=/i;

function getExtensionApi() {
  if (typeof browser !== "undefined" && browser.runtime) {
    return browser;
  }

  if (typeof chrome !== "undefined" && chrome.runtime) {
    return chrome;
  }

  return null;
}

async function getStoredPatterns(extensionApi = getExtensionApi()) {
  const stored = await extensionApi.storage.local.get({ [STORAGE_KEY]: [] });
  return stored[STORAGE_KEY];
}

async function getPrimaryPattern(extensionApi = getExtensionApi()) {
  const stored = await extensionApi.storage.local.get({ [PRIMARY_STORAGE_KEY]: "" });
  return String(stored[PRIMARY_STORAGE_KEY] || "").trim();
}

async function isWhitelistedUrl(url, extensionApi = getExtensionApi()) {
  const patterns = await getStoredPatterns(extensionApi);

  return XfoRuleBuilder.normalizePatterns(patterns).some((pattern) => (
    XfoRuleBuilder.doesUrlMatchPattern(url, pattern)
  ));
}

async function clearDynamicRules(extensionApi = getExtensionApi()) {
  const existingRules = await extensionApi.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  if (removeRuleIds.length === 0) {
    return;
  }

  await extensionApi.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
}

async function getChatGptCookieHeader(extensionApi = getExtensionApi()) {
  const cookies = await extensionApi.cookies.getAll({ url: CHATGPT_COOKIE_URL });
  const cookieHeaderValue = XfoRuleBuilder.buildChatGptCookieHeader(cookies);

  if (cookieHeaderValue) {
    return cookieHeaderValue;
  }

  const domainCookies = await extensionApi.cookies.getAll({ domain: CHATGPT_COOKIE_DOMAIN });
  return XfoRuleBuilder.buildChatGptCookieHeader(domainCookies);
}

async function getWhitelistedTabIds(patterns, extensionApi = getExtensionApi()) {
  const tabs = await extensionApi.tabs.query({});
  const normalizedPatterns = XfoRuleBuilder.normalizePatterns(patterns);

  return tabs
    .filter((tab) => Number.isInteger(tab.id))
    .filter((tab) => normalizedPatterns.some((pattern) => (
      XfoRuleBuilder.doesUrlMatchPattern(tab.url, pattern)
    )))
    .map((tab) => tab.id);
}

async function isWhitelistedTabId(tabId, extensionApi = getExtensionApi()) {
  if (!Number.isInteger(tabId) || tabId < 0 || !extensionApi?.tabs?.get) {
    return false;
  }

  const tab = await extensionApi.tabs.get(tabId);
  return isWhitelistedUrl(tab.url, extensionApi);
}

function removeChatGptFrameBlockingHeaders(responseHeaders = []) {
  return responseHeaders.filter((header) => {
    const headerName = String(header.name || "").toLowerCase();

    if (CHATGPT_FRAME_RESPONSE_HEADERS_TO_REMOVE.has(headerName)) {
      return false;
    }

    return !isRejectedChatGptSetCookieHeader(header);
  });
}

function removeRejectedChatGptSetCookieHeaders(responseHeaders = []) {
  return responseHeaders.filter(isAllowedChatGptResponseHeader);
}

function buildChatGptRequestHeaders(requestHeaders = [], cookieHeaderValue = "") {
  const nextHeaders = requestHeaders.filter((header) => {
    const headerName = String(header.name || "").toLowerCase();
    return headerName !== "cookie" && !CHATGPT_REQUEST_HEADERS_TO_REMOVE.has(headerName);
  });

  if (cookieHeaderValue) {
    nextHeaders.push({
      name: "Cookie",
      value: cookieHeaderValue,
    });
  }

  return nextHeaders;
}

function isRejectedChatGptSetCookieHeader(header) {
  return !isAllowedChatGptResponseHeader(header);
}

function isAllowedChatGptResponseHeader(header) {
  const headerName = String(header.name || "").toLowerCase();

  if (headerName === "set-cookie") {
    return CHATGPT_SESSION_SET_COOKIE_PATTERN.test(String(header.value || ""));
  }

  return true;
}

function shouldRegisterFirefoxWebRequestFallback(extensionApi = getExtensionApi()) {
  return (
    typeof browser !== "undefined"
    && extensionApi === browser
    && Boolean(extensionApi.webRequest?.onHeadersReceived)
  );
}

function registerFirefoxWebRequestFallback(extensionApi = getExtensionApi()) {
  if (!shouldRegisterFirefoxWebRequestFallback(extensionApi)) {
    return;
  }

  extensionApi.webRequest.onBeforeSendHeaders.addListener(
    async (details) => {
      if (!(await isWhitelistedTabId(details.tabId, extensionApi))) {
        return {};
      }

      return {
        requestHeaders: buildChatGptRequestHeaders(
          details.requestHeaders,
          await getChatGptCookieHeader(extensionApi),
        ),
      };
    },
    { urls: CHATGPT_WEBREQUEST_URLS },
    ["blocking", "requestHeaders"],
  );

  extensionApi.webRequest.onHeadersReceived.addListener(
    async (details) => {
      if (!(await isWhitelistedTabId(details.tabId, extensionApi))) {
        return {};
      }

      return {
        responseHeaders: details.type === "sub_frame"
          ? removeChatGptFrameBlockingHeaders(details.responseHeaders)
          : removeRejectedChatGptSetCookieHeaders(details.responseHeaders),
      };
    },
    { urls: CHATGPT_WEBREQUEST_URLS },
    ["blocking", "responseHeaders"],
  );
}

async function refreshSessionRules(patterns, extensionApi = getExtensionApi()) {
  const tabIds = await getWhitelistedTabIds(patterns, extensionApi);
  const existingRules = await extensionApi.declarativeNetRequest.getSessionRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);
  const addRules = [];

  if (tabIds.length > 0) {
    const cookieHeaderValue = await getChatGptCookieHeader(extensionApi);

    addRules.push(
      ...XfoRuleBuilder.buildHeaderRemovalRules(patterns, tabIds),
      XfoRuleBuilder.buildChatGptIframeRequestHeaderRule(cookieHeaderValue, tabIds),
    );
  }

  await extensionApi.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds,
  });

  return addRules.length;
}

async function refreshRules(extensionApi = getExtensionApi()) {
  const patterns = await getStoredPatterns(extensionApi);
  const existingRules = await extensionApi.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await extensionApi.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds,
  });

  return refreshSessionRules(patterns, extensionApi);
}

async function handleActionClick(extensionApi = getExtensionApi(), activeTab = {}) {
  if (await isWhitelistedUrl(activeTab.url, extensionApi)) {
    await extensionApi.runtime.openOptionsPage();
    return;
  }

  const primaryPattern = await getPrimaryPattern(extensionApi);

  if (primaryPattern) {
    await extensionApi.tabs.create({ url: primaryPattern });
    return;
  }

  await extensionApi.runtime.openOptionsPage();
}

const extensionApi = getExtensionApi();

if (extensionApi) {
  extensionApi.runtime.onInstalled.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to initialize X-Frame-Options removal rules", error);
    });
  });

  extensionApi.runtime.onStartup.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh X-Frame-Options removal rules", error);
    });
  });

  extensionApi.action.onClicked.addListener((tab) => {
    handleActionClick(extensionApi, tab).catch((error) => {
      console.error("Failed to open the primary page", error);
    });
  });

  extensionApi.cookies.onChanged.addListener((changeInfo) => {
    const cookieDomain = changeInfo.cookie?.domain?.replace(/^\./, "");

    if (cookieDomain !== CHATGPT_COOKIE_DOMAIN) {
      return;
    }

    refreshRules().catch((error) => {
      console.error("Failed to refresh ChatGPT cookie header rule", error);
    });
  });

  extensionApi.tabs.onUpdated.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh tab-scoped ChatGPT rules", error);
    });
  });

  extensionApi.tabs.onRemoved.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh tab-scoped ChatGPT rules", error);
    });
  });

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "refreshRules") {
      return false;
    }

    refreshRules()
      .then((ruleCount) => sendResponse({ ok: true, ruleCount }))
      .catch((error) => {
        console.error("Failed to refresh X-Frame-Options removal rules", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  });

  registerFirefoxWebRequestFallback(extensionApi);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildChatGptRequestHeaders,
    getExtensionApi,
    getWhitelistedTabIds,
    handleActionClick,
    isWhitelistedUrl,
    registerFirefoxWebRequestFallback,
    removeChatGptFrameBlockingHeaders,
    removeRejectedChatGptSetCookieHeaders,
    refreshRules,
    refreshSessionRules,
    shouldRegisterFirefoxWebRequestFallback,
  };
}
