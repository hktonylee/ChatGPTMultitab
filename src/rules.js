(function attachRuleBuilder(root) {
  const HEADER_REMOVALS = [
    { header: "x-frame-options", operation: "remove" },
    { header: "frame-options", operation: "remove" },
  ];
  const CHATGPT_IFRAME_RESPONSE_HEADER_REMOVALS = [
    ...HEADER_REMOVALS,
    { header: "content-security-policy", operation: "remove" },
    { header: "content-security-policy-report-only", operation: "remove" },
  ];

  const CHATGPT_IFRAME_RULE_ID = 1;
  const USER_RULE_ID_START = 100;
  const CHATGPT_IFRAME_REQUEST_HEADER_REMOVALS = [
    { header: "sec-fetch-dest", operation: "remove" },
    { header: "sec-fetch-mode", operation: "remove" },
    { header: "sec-fetch-site", operation: "remove" },
    { header: "sec-fetch-user", operation: "remove" },
    { header: "referer", operation: "remove" },
    { header: "origin", operation: "remove" },
  ];

  function normalizePatterns(patterns) {
    const seen = new Set();
    const normalized = [];

    for (const pattern of patterns || []) {
      const value = String(pattern).trim();
      if (!value || seen.has(value)) {
        continue;
      }

      seen.add(value);
      normalized.push(value);
    }

    return normalized;
  }

  function escapeRegExp(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }

  function doesUrlMatchPattern(url, pattern) {
    const normalizedPattern = String(pattern || "").trim();
    const normalizedUrl = String(url || "").trim();

    if (!normalizedPattern || !normalizedUrl) {
      return false;
    }

    const expression = normalizedPattern.split("*").map(escapeRegExp).join(".*");
    return new RegExp(`^${expression}$`).test(normalizedUrl);
  }

  function buildHeaderRemovalRules(patterns) {
    return normalizePatterns(patterns).map((pattern, index) => ({
      id: USER_RULE_ID_START + index,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: HEADER_REMOVALS.map((headerRemoval) => ({ ...headerRemoval })),
      },
      condition: {
        urlFilter: pattern,
        resourceTypes: ["main_frame", "sub_frame"],
      },
    }));
  }

  function buildChatGptIframeRequestHeaderRule() {
    return {
      id: CHATGPT_IFRAME_RULE_ID,
      priority: 2,
      action: {
        type: "modifyHeaders",
        requestHeaders: CHATGPT_IFRAME_REQUEST_HEADER_REMOVALS.map((headerRemoval) => ({
          ...headerRemoval,
        })),
        responseHeaders: CHATGPT_IFRAME_RESPONSE_HEADER_REMOVALS.map((headerRemoval) => ({
          ...headerRemoval,
        })),
      },
      condition: {
        urlFilter: "||chatgpt.com/",
        resourceTypes: ["sub_frame"],
      },
    };
  }

  function buildDynamicRules(patterns) {
    return [buildChatGptIframeRequestHeaderRule(), ...buildHeaderRemovalRules(patterns)];
  }

  const api = {
    buildChatGptIframeRequestHeaderRule,
    buildDynamicRules,
    buildHeaderRemovalRules,
    doesUrlMatchPattern,
    normalizePatterns,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.XfoRuleBuilder = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
