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

async function getStoredPatterns(extensionChrome = chrome) {
  const stored = await extensionChrome.storage.local.get({ [STORAGE_KEY]: [] });
  return stored[STORAGE_KEY];
}

async function getPrimaryPattern(extensionChrome = chrome) {
  const stored = await extensionChrome.storage.local.get({ [PRIMARY_STORAGE_KEY]: "" });
  return String(stored[PRIMARY_STORAGE_KEY] || "").trim();
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

  if (cookies.length > 0) {
    return XfoRuleBuilder.buildChatGptCookieHeader(cookies);
  }

  const domainCookies = await extensionChrome.cookies.getAll({ domain: CHATGPT_COOKIE_DOMAIN });
  return XfoRuleBuilder.buildChatGptCookieHeader(domainCookies);
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

    addRules.push(
      ...XfoRuleBuilder.buildHeaderRemovalRules(patterns, tabIds),
      XfoRuleBuilder.buildChatGptIframeRequestHeaderRule(cookieHeaderValue, tabIds),
    );
  }

  await extensionChrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds,
  });

  return addRules.length;
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

async function handleActionClick(extensionChrome = chrome) {
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

  chrome.action.onClicked.addListener(() => {
    handleActionClick().catch((error) => {
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

  chrome.tabs.onRemoved.addListener(() => {
    refreshRules().catch((error) => {
      console.error("Failed to refresh tab-scoped ChatGPT rules", error);
    });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getWhitelistedTabIds,
    handleActionClick,
    refreshRules,
    refreshSessionRules,
  };
}
