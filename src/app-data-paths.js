const fs = require("node:fs");
const path = require("node:path");

const APP_DATA_DIRECTORY_NAME = "ChatGPT Multitab";

function configureStableAppDataPaths(app, platform = process.platform) {
  if (platform !== "win32") {
    return null;
  }

  const stableDataPath = path.join(app.getPath("appData"), APP_DATA_DIRECTORY_NAME);
  fs.mkdirSync(stableDataPath, { recursive: true });
  app.setPath("userData", stableDataPath);
  app.setPath("sessionData", stableDataPath);
  return stableDataPath;
}

module.exports = { APP_DATA_DIRECTORY_NAME, configureStableAppDataPaths };
