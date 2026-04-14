const assert = require("node:assert/strict");
const test = require("node:test");

const { buildHeaderRemovalRules, normalizePatterns } = require("../src/rules");

test("normalizes patterns by trimming blanks and removing duplicates", () => {
  assert.deepEqual(
    normalizePatterns([
      "  http://localhost:8080/*  ",
      "",
      "http://localhost:8080/*",
      "file:///home/tonylee/example.html",
    ]),
    ["http://localhost:8080/*", "file:///home/tonylee/example.html"],
  );
});

test("builds dynamic rules that remove frame option response headers", () => {
  assert.deepEqual(buildHeaderRemovalRules(["http://localhost:8080/*"]), [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "frame-options", operation: "remove" },
        ],
      },
      condition: {
        urlFilter: "http://localhost:8080/*",
        resourceTypes: ["main_frame", "sub_frame"],
      },
    },
  ]);
});
