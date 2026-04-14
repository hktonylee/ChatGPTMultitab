(function attachRuleBuilder(root) {
  const HEADER_REMOVALS = [
    { header: "x-frame-options", operation: "remove" },
    { header: "frame-options", operation: "remove" },
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

  function buildHeaderRemovalRules(patterns) {
    return normalizePatterns(patterns).map((pattern, index) => ({
      id: index + 1,
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

  const api = { buildHeaderRemovalRules, normalizePatterns };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.XfoRuleBuilder = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
