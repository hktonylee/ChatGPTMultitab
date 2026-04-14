importScripts("rules.js");

const STORAGE_KEY = "urlPatterns";

async function getStoredPatterns() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return stored[STORAGE_KEY];
}

async function clearDynamicRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  if (removeRuleIds.length === 0) {
    return;
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
}

async function refreshRules() {
  const patterns = await getStoredPatterns();
  const addRules = XfoRuleBuilder.buildDynamicRules(patterns);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds,
  });

  return addRules.length;
}

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
