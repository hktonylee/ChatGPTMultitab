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
const CHATGPT_IFRAME_RULE_ID_START = 10000;
const chatGptFrameReferersByTabId = new Map();

async function getStoredPatterns(extensionChrome = chrome) {
  const stored = await extensionChrome.storage.local.get({ [STORAGE_KEY]: [] });
  return stored[STORAGE_KEY];
}

async function getPrimaryPattern(extensionChrome = chrome) {
  const stored = await extensionChrome.storage.local.get({ [PRIMARY_STORAGE_KEY]: "" });
  return String(stored[PRIMARY_STORAGE_KEY] || "").trim();
}

async function isWhitelistedUrl(url, extensionChrome = chrome) {
  const patterns = await getStoredPatterns(extensionChrome);

  return XfoRuleBuilder.normalizePatterns(patterns).some((pattern) => (
    XfoRuleBuilder.doesUrlMatchPattern(url, pattern)
  ));
}

async function clearDynamicRules(extensionChrome = chrome) {
  const existingRules = await extensionChrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  if (removeRuleIds.length === 0) {
    return;
  }

  await extensionChrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
}

async function getChatGptCookieHeader(extensionChrome = chrome) {
  const cookies = await extensionChrome.cookies.getAll({ url: CHATGPT_COOKIE_URL });
  const domainCookies = await extensionChrome.cookies.getAll({ domain: CHATGPT_COOKIE_DOMAIN });
  const seenCookies = new Set();
  const chatGptCookies = [];

  for (const cookie of [...cookies, ...domainCookies]) {
    const cookieKey = [
      cookie?.name || "",
      cookie?.domain || "",
      cookie?.path || "",
    ].join("\n");

    if (seenCookies.has(cookieKey)) {
      continue;
    }

    seenCookies.add(cookieKey);
    chatGptCookies.push(cookie);
  }

  return XfoRuleBuilder.buildChatGptCookieHeader(chatGptCookies);
}

async function getWhitelistedTabIds(patterns, extensionChrome = chrome) {
  const tabs = await extensionChrome.tabs.query({});
  const normalizedPatterns = XfoRuleBuilder.normalizePatterns(patterns);

  return tabs
    .filter((tab) => Number.isInteger(tab.id))
    .filter((tab) => normalizedPatterns.some((pattern) => (
      XfoRuleBuilder.doesUrlMatchPattern(tab.url, pattern)
    )))
    .map((tab) => tab.id);
}

async function refreshSessionRules(patterns, extensionChrome = chrome) {
  const tabIds = await getWhitelistedTabIds(patterns, extensionChrome);
  const existingRules = await extensionChrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);
  const addRules = [];

  if (tabIds.length > 0) {
    const cookieHeaderValue = await getChatGptCookieHeader(extensionChrome);
    const chatGptIframeRules = tabIds.map((tabId, index) => (
      XfoRuleBuilder.buildChatGptIframeRequestHeaderRule(
        cookieHeaderValue,
        [tabId],
        chatGptFrameReferersByTabId.get(tabId),
        CHATGPT_IFRAME_RULE_ID_START + index,
      )
    ));

    addRules.push(
      ...XfoRuleBuilder.buildHeaderRemovalRules(patterns, tabIds),
      ...chatGptIframeRules,
    );
  }

  await extensionChrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds,
  });

  return addRules.length;
}

function clearChatGptFrameReferers() {
  chatGptFrameReferersByTabId.clear();
}

async function refreshChatGptFrameReferer(message, sender = {}, extensionChrome = chrome) {
  const tabId = sender.tab?.id;

  if (!Number.isInteger(tabId) || !(await isWhitelistedUrl(sender.tab?.url, extensionChrome))) {
    return refreshRules(extensionChrome);
  }

  chatGptFrameReferersByTabId.set(
    tabId,
    XfoRuleBuilder.normalizeChatGptRefererUrl(message?.url),
  );

  return refreshRules(extensionChrome);
}

async function refreshRules(extensionChrome = chrome) {
  const patterns = await getStoredPatterns(extensionChrome);
  const existingRules = await extensionChrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await extensionChrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds,
  });

  return refreshSessionRules(patterns, extensionChrome);
}

async function handleActionClick(extensionChrome = chrome, activeTab = {}) {
  if (await isWhitelistedUrl(activeTab.url, extensionChrome)) {
    await extensionChrome.runtime.openOptionsPage();
    return;
  }

  const primaryPattern = await getPrimaryPattern(extensionChrome);

  if (primaryPattern) {
    await extensionChrome.tabs.create({ url: primaryPattern });
    return;
  }

  await extensionChrome.runtime.openOptionsPage();
}

if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to initialize X-Frame-Options removal rules", error);
    });
  });

  chrome.runtime.onStartup.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh X-Frame-Options removal rules", error);
    });
  });

  chrome.action.onClicked.addListener((tab) => {
    handleActionClick(chrome, tab).catch((error) => {
      console.error("Failed to open the primary page", error);
    });
  });

  chrome.cookies.onChanged.addListener((changeInfo) => {
    const cookieDomain = changeInfo.cookie?.domain?.replace(/^\./, "");

    if (cookieDomain !== CHATGPT_COOKIE_DOMAIN) {
      return;
    }

    refreshRules().catch((error) => {
      console.error("Failed to refresh ChatGPT cookie header rule", error);
    });
  });

  chrome.tabs.onUpdated.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh tab-scoped ChatGPT rules", error);
    });
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    chatGptFrameReferersByTabId.delete(tabId);
    refreshRules().catch((error) => {
      console.error("Failed to refresh tab-scoped ChatGPT rules", error);
    });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || (message.type !== "refreshRules" && message.type !== "chatgptFrameLocation")) {
      return false;
    }

    const refreshPromise = message.type === "chatgptFrameLocation"
      ? refreshChatGptFrameReferer(message, _sender)
      : refreshRules();

    refreshPromise
      .then((ruleCount) => sendResponse({ ok: true, ruleCount }))
      .catch((error) => {
        console.error("Failed to refresh X-Frame-Options removal rules", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    clearChatGptFrameReferers,
    getWhitelistedTabIds,
    handleActionClick,
    isWhitelistedUrl,
    refreshChatGptFrameReferer,
    refreshRules,
    refreshSessionRules,
  };
}
