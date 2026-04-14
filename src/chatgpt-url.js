(function attachChatGptUrl(root) {
  const CHAT_URL_PATTERN = /^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+\/?$/i;

  function normalizeUrl(value, baseUrl = "https://chatgpt.com/") {
    try {
      return new URL(String(value || "").trim(), baseUrl).href;
    } catch (_error) {
      return "";
    }
  }

  function isConversationUrl(value) {
    return CHAT_URL_PATTERN.test(normalizeUrl(value));
  }

  function extractPersistedChatUrl(currentUrl, candidateUrls = []) {
    const normalizedCurrentUrl = normalizeUrl(currentUrl);

    if (isConversationUrl(normalizedCurrentUrl)) {
      return normalizedCurrentUrl;
    }

    for (const candidateUrl of candidateUrls) {
      const normalizedCandidateUrl = normalizeUrl(candidateUrl, normalizedCurrentUrl);

      if (isConversationUrl(normalizedCandidateUrl)) {
        return normalizedCandidateUrl;
      }
    }

    return normalizedCurrentUrl || "https://chatgpt.com/";
  }

  const api = {
    extractPersistedChatUrl,
    isConversationUrl,
    normalizeUrl,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.ChatGptUrl = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
