const STORAGE_KEY = "urlPatterns";
const PRIMARY_STORAGE_KEY = "primaryUrl";

const form = document.querySelector("#pattern-form");
const input = document.querySelector("#pattern-input");
const list = document.querySelector("#pattern-list");
const emptyState = document.querySelector("#empty-state");
const statusMessage = document.querySelector("#status");

let patterns = [];
let primaryPattern = "";
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
    const summary = document.createElement("div");
    const actions = document.createElement("div");
    const code = document.createElement("code");
    const primaryBadge = document.createElement("span");
    const matchStatus = document.createElement("small");
    const primaryButton = document.createElement("button");
    const openButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const isPrimary = pattern === primaryPattern;

    details.className = "pattern-details";
    summary.className = "pattern-summary";
    actions.className = "pattern-actions";
    code.textContent = pattern;

    if (isPrimary) {
      primaryBadge.className = "primary-badge";
      primaryBadge.textContent = "Primary";
    }

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

    if (!isPrimary) {
      primaryButton.type = "button";
      primaryButton.className = "secondary";
      primaryButton.textContent = "Set as primary";
      primaryButton.addEventListener("click", () => setPrimary(pattern));
    }

    openButton.type = "button";
    openButton.className = "secondary";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openPattern(pattern));

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removePattern(pattern));

    summary.append(code);
    if (isPrimary) {
      summary.append(primaryBadge);
    }

    details.append(summary, matchStatus);
    if (!isPrimary) {
      actions.append(primaryButton);
    }
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
  const normalizedState = XfoRuleBuilder.normalizePatternState(nextPatterns, primaryPattern);
  patterns = normalizedState.patterns;
  primaryPattern = normalizedState.primaryPattern;

  await chrome.storage.local.set({
    [STORAGE_KEY]: patterns,
    [PRIMARY_STORAGE_KEY]: primaryPattern,
  });
  const ruleCount = await refreshRules();

  renderPatterns();
  setStatus(`Saved ${ruleCount} active URL${ruleCount === 1 ? "" : "s"}.`);
}

async function removePattern(pattern) {
  try {
    const nextState = XfoRuleBuilder.removePatternFromState(patterns, pattern, primaryPattern);
    patterns = nextState.patterns;
    primaryPattern = nextState.primaryPattern;
    await savePatterns(patterns);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function setPrimary(pattern) {
  try {
    const nextState = XfoRuleBuilder.setPrimaryPattern(patterns, pattern);
    patterns = nextState.patterns;
    primaryPattern = nextState.primaryPattern;
    await savePatterns(patterns);
    setStatus("Primary URL updated.");
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
      chrome.storage.local.get({ [STORAGE_KEY]: [], [PRIMARY_STORAGE_KEY]: "" }),
      getCurrentTabUrl(),
    ]);

    const normalizedState = XfoRuleBuilder.normalizePatternState(
      stored[STORAGE_KEY],
      stored[PRIMARY_STORAGE_KEY],
    );

    patterns = normalizedState.patterns;
    primaryPattern = normalizedState.primaryPattern;
    currentUrl = activeUrl;

    await chrome.storage.local.set({
      [STORAGE_KEY]: patterns,
      [PRIMARY_STORAGE_KEY]: primaryPattern,
    });

    renderPatterns();
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadPatterns();
