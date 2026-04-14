const STORAGE_KEY = "urlPatterns";

const form = document.querySelector("#pattern-form");
const input = document.querySelector("#pattern-input");
const list = document.querySelector("#pattern-list");
const emptyState = document.querySelector("#empty-state");
const statusMessage = document.querySelector("#status");

let patterns = [];
let currentUrl = "";

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function renderPatterns() {
  list.replaceChildren();
  emptyState.hidden = patterns.length > 0;

  for (const pattern of patterns) {
    const item = document.createElement("li");
    const details = document.createElement("div");
    const actions = document.createElement("div");
    const code = document.createElement("code");
    const matchStatus = document.createElement("small");
    const openButton = document.createElement("button");
    const removeButton = document.createElement("button");

    details.className = "pattern-details";
    actions.className = "pattern-actions";
    code.textContent = pattern;

    if (currentUrl) {
      const matchesCurrentUrl = XfoRuleBuilder.doesUrlMatchPattern(currentUrl, pattern);
      matchStatus.className = `match-status ${matchesCurrentUrl ? "match" : "miss"}`;
      matchStatus.textContent = matchesCurrentUrl
        ? "Matches current URL"
        : "Does not match current URL";
    } else {
      matchStatus.className = "match-status";
      matchStatus.textContent = "Current URL unavailable";
    }

    openButton.type = "button";
    openButton.className = "secondary";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openPattern(pattern));

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removePattern(pattern));

    details.append(code, matchStatus);
    actions.append(openButton, removeButton);
    item.append(details, actions);
    list.append(item);
  }
}

async function getCurrentTabUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] && tabs[0].url ? tabs[0].url : "";
  } catch (_error) {
    return "";
  }
}

async function refreshRules() {
  const response = await chrome.runtime.sendMessage({ type: "refreshRules" });

  if (!response || !response.ok) {
    throw new Error(response && response.error ? response.error : "Rule refresh failed.");
  }

  return response.ruleCount;
}

async function savePatterns(nextPatterns) {
  patterns = XfoRuleBuilder.normalizePatterns(nextPatterns);
  await chrome.storage.local.set({ [STORAGE_KEY]: patterns });
  const ruleCount = await refreshRules();

  renderPatterns();
  setStatus(`Saved ${ruleCount} active URL${ruleCount === 1 ? "" : "s"}.`);
}

async function removePattern(pattern) {
  try {
    await savePatterns(patterns.filter((existingPattern) => existingPattern !== pattern));
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function openPattern(pattern) {
  try {
    await chrome.tabs.create({ url: pattern });
  } catch (error) {
    setStatus(error.message, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pattern = input.value.trim();
  if (!pattern) {
    setStatus("Enter an exact URL before adding it.", true);
    return;
  }

  try {
    await savePatterns([...patterns, pattern]);
    input.value = "";
    input.focus();
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function loadPatterns() {
  try {
    const [stored, activeUrl] = await Promise.all([
      chrome.storage.local.get({ [STORAGE_KEY]: [] }),
      getCurrentTabUrl(),
    ]);

    patterns = XfoRuleBuilder.normalizePatterns(stored[STORAGE_KEY]);
    currentUrl = activeUrl;
    renderPatterns();
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadPatterns();
