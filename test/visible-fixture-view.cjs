const { WebContentsView } = require("electron");

// Electron initializes embedded renderers hidden. Instant local responses can
// finish before native attachment makes them visible. Keep fixture renderers
// initially visible so native hit/click checks exercise the page, not that race.
class VisibleFixtureView {
  constructor(options) {
    return new WebContentsView({
      ...options,
      webPreferences: { ...options.webPreferences, show: true },
    });
  }
}

module.exports = { VisibleFixtureView };
