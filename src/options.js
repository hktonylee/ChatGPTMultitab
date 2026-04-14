const STORAGE_KEY = "urlPatterns";

const form = document.querySelector("#pattern-form");
const input = document.querySelector("#pattern-input");
const list = document.querySelector("#pattern-list");
const emptyState = document.querySelector("#empty-state");
const statusMessage = document.querySelector("#status");

let patterns = [];

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function renderPatterns() {
  list.replaceChildren();
  emptyState.hidden = patterns.length > 0;

  for (const pattern of patterns) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    const openButton = document.createElement("button");
    const removeButton = document.createElement("button");

    code.textContent = pattern;
    openButton.type = "button";
    openButton.className = "secondary";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openPattern(pattern));

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removePattern(pattern));

    item.append(code, openButton, removeButton);
    list.append(item);
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
    const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
    patterns = XfoRuleBuilder.normalizePatterns(stored[STORAGE_KEY]);
    renderPatterns();
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadPatterns();
