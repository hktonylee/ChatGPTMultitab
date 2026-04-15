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
  const CHATGPT_RESOURCE_TYPES = ["sub_frame", "image", "xmlhttprequest", "media"];

  function buildChatGptCookieHeader(cookies) {
    return (cookies || [])
      .filter((cookie) => cookie && cookie.name)
      .map((cookie) => `${cookie.name}=${cookie.value || ""}`)
      .join("; ");
  }

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

  function normalizePatternState(patterns, primaryPattern = "") {
    const normalizedPatterns = normalizePatterns(patterns);
    const normalizedPrimaryPattern = String(primaryPattern || "").trim();

    if (!normalizedPrimaryPattern) {
      return {
        patterns: normalizedPatterns,
        primaryPattern: "",
      };
    }

    if (!normalizedPatterns.includes(normalizedPrimaryPattern)) {
      return {
        patterns: normalizedPatterns,
        primaryPattern: "",
      };
    }

    return {
      patterns: [
        normalizedPrimaryPattern,
        ...normalizedPatterns.filter((pattern) => pattern !== normalizedPrimaryPattern),
      ],
      primaryPattern: normalizedPrimaryPattern,
    };
  }

  function setPrimaryPattern(patterns, primaryPattern) {
    return normalizePatternState(patterns, primaryPattern);
  }

  function removePatternFromState(patterns, patternToRemove, primaryPattern = "") {
    const nextPatterns = normalizePatterns(patterns).filter((pattern) => pattern !== patternToRemove);
    const nextPrimaryPattern = String(primaryPattern || "").trim() === String(patternToRemove || "").trim()
      ? ""
      : primaryPattern;

    return normalizePatternState(nextPatterns, nextPrimaryPattern);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildExactUrlRegex(url) {
    return `^${escapeRegExp(url)}$`;
  }

  function doesUrlMatchPattern(url, pattern) {
    const normalizedPattern = String(pattern || "").trim();
    const normalizedUrl = String(url || "").trim();

    if (!normalizedPattern || !normalizedUrl) {
      return false;
    }

    return normalizedUrl === normalizedPattern;
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
        regexFilter: buildExactUrlRegex(pattern),
        resourceTypes: ["main_frame", "sub_frame"],
      },
    }));
  }

  function buildChatGptIframeRequestHeaderRule(cookieHeaderValue = "", tabIds = []) {
    const requestHeaders = CHATGPT_IFRAME_REQUEST_HEADER_REMOVALS.map((headerRemoval) => ({
      ...headerRemoval,
    }));
    const condition = {
      urlFilter: "||chatgpt.com/",
      resourceTypes: [...CHATGPT_RESOURCE_TYPES],
    };

    if (cookieHeaderValue) {
      requestHeaders.push({
        header: "cookie",
        operation: "set",
        value: cookieHeaderValue,
      });
    }

    if (tabIds.length > 0) {
      condition.tabIds = [...tabIds];
    }

    return {
      id: CHATGPT_IFRAME_RULE_ID,
      priority: 2,
      action: {
        type: "modifyHeaders",
        requestHeaders,
        responseHeaders: CHATGPT_IFRAME_RESPONSE_HEADER_REMOVALS.map((headerRemoval) => ({
          ...headerRemoval,
        })),
      },
      condition,
    };
  }

  function buildDynamicRules(patterns) {
    return buildHeaderRemovalRules(patterns);
  }

  const api = {
    buildChatGptCookieHeader,
    buildChatGptIframeRequestHeaderRule,
    buildDynamicRules,
    buildHeaderRemovalRules,
    doesUrlMatchPattern,
    normalizePatternState,
    normalizePatterns,
    removePatternFromState,
    setPrimaryPattern,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.XfoRuleBuilder = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
