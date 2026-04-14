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

async function getStoredPatterns() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return stored[STORAGE_KEY];
}

async function getPrimaryPattern(extensionChrome = chrome) {
  const stored = await extensionChrome.storage.local.get({ [PRIMARY_STORAGE_KEY]: "" });
  return String(stored[PRIMARY_STORAGE_KEY] || "").trim();
}

async function clearDynamicRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  if (removeRuleIds.length === 0) {
    return;
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
}

async function getChatGptCookieHeader() {
  const cookies = await chrome.cookies.getAll({ url: CHATGPT_COOKIE_URL });

  if (cookies.length > 0) {
    return XfoRuleBuilder.buildChatGptCookieHeader(cookies);
  }

  const domainCookies = await chrome.cookies.getAll({ domain: CHATGPT_COOKIE_DOMAIN });
  return XfoRuleBuilder.buildChatGptCookieHeader(domainCookies);
}

async function refreshRules() {
  const patterns = await getStoredPatterns();
  const cookieHeaderValue = await getChatGptCookieHeader();
  const addRules = XfoRuleBuilder.buildDynamicRules(patterns, cookieHeaderValue);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds,
  });

  return addRules.length;
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
    handleActionClick,
  };
}
