const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("package starts the Electron app from the main process entrypoint", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));

  assert.equal(packageJson.main, "electron/main.js");
  assert.equal(packageJson.scripts.start, "electron .");
  assert.equal(packageJson.devDependencies.electron.startsWith("^"), true);
});

test("electron main process wraps ChatGPT pages in WebContentsView instances", () => {
  const mainSource = readRepoFile("electron", "main.js");
  const tabControllerSource = readRepoFile("src", "electron-tabs.js");

  assert.match(mainSource, /WebContentsView/);
  assert.match(mainSource, /new WebContentsView\(/);
  assert.match(tabControllerSource, /contentView\.addChildView/);
  assert.match(tabControllerSource, /\.webContents\.loadURL\(tab\.url\)/);
  assert.doesNotMatch(mainSource, /BrowserView/);
  assert.doesNotMatch(mainSource, /<iframe/i);
});

test("electron main process configures permissions through the Electron session module", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /session\.defaultSession\.setPermissionRequestHandler/);
  assert.doesNotMatch(mainSource, /app\.session/);
});

test("electron main window hides the native menu bar", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /autoHideMenuBar:\s*true/);
  assert.match(mainSource, /const IS_MACOS = process\.platform === "darwin";/);
  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(mainSource, /trafficLightPosition:\s*\{\s*x:\s*12,\s*y:\s*14\s*\}/);
  assert.match(mainSource, /mainWindow\.setMenuBarVisibility\(false\)/);
  assert.match(mainSource, /mainWindow\.setMenu\(null\)/);
});

test("electron main window returns focus to the active ChatGPT view when refocused", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /mainWindow\.on\("focus", \(\) => \{/);
  assert.match(mainSource, /tabController\.focusActiveTab\(\)/);
});

test("electron main process registers Command+Shift+C on macOS to focus the app and open or reuse a new-tab target", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /globalShortcut/);
  assert.match(mainSource, /const NEW_TAB_SHORTCUTS = Object\.freeze\(\[IS_MACOS \? "Command\+Shift\+C" : "Super\+C"\]\);/);
  assert.doesNotMatch(mainSource, /Super\+Enter/);
  assert.match(mainSource, /function registerNewTabShortcuts\(\)/);
  assert.match(mainSource, /NEW_TAB_SHORTCUTS\.forEach\(\(shortcut\) => \{/);
  assert.match(mainSource, /const registered = globalShortcut\.register\(shortcut, \(\) => \{/);
  assert.match(mainSource, /openNewTabInMainWindow\(\)/);
  assert.match(mainSource, /tabController\.createTabForNewTabRequest\(url\)/);
  assert.match(mainSource, /console\.warn\(`Failed to register global shortcut \$\{shortcut\}`\)/);
  assert.match(mainSource, /app\.on\("will-quit", \(\) => \{/);
  assert.match(mainSource, /NEW_TAB_SHORTCUTS\.forEach\(\(shortcut\) => globalShortcut\.unregister\(shortcut\)\)/);
});

test("electron main process opens a new tab from a second-instance command argument", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /const NEW_TAB_ARG = "--new-tab";/);
  assert.match(mainSource, /app\.requestSingleInstanceLock\(\)/);
  assert.match(mainSource, /app\.on\("second-instance", \(_event, argv\) => \{/);
  assert.match(mainSource, /handleOpenRequest\(argv\)/);
  assert.match(mainSource, /argv\.includes\(NEW_TAB_ARG\)/);
  assert.match(mainSource, /tabController\.createTabForNewTabRequest\(url\)/);
  assert.match(mainSource, /focusMainWindow\(\)/);
});

test("electron main process opens ChatGPT url arguments in app tabs", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /const \{[^}]*normalizeTabUrl[^}]*\} = require\("\.\.\/src\/session-state"\);/s);
  assert.match(mainSource, /function getChatGptUrlArg\(argv = \[\]\) \{/);
  assert.match(mainSource, /normalizeTabUrl\(arg\)/);
  assert.match(mainSource, /function openNewTabInMainWindow\(url\)/);
  assert.match(mainSource, /tabController\.createTabForNewTabRequest\(url\)/);
  assert.match(mainSource, /const url = getChatGptUrlArg\(argv\);/);
  assert.match(mainSource, /if \(url\) \{/);
  assert.match(mainSource, /return openNewTabInMainWindow\(url\);/);
});

test("repo no longer ships the AutoHotkey launcher path", () => {
  assert.equal(fs.existsSync(path.join(repoRoot, "ChatGPTMultitab.ahk")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, "favicon-inverted.ico")), false);
});

test("electron app uses the inverted PNG logo", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const mainSource = readRepoFile("electron", "main.js");

  assert.equal(fs.existsSync(path.join(repoRoot, "favicon-inverted.png")), true);
  assert.match(mainSource, /const APP_ICON_FILE = "favicon-inverted\.png";/);
  assert.match(mainSource, /icon:\s*getAppIconPath\(\)/);
  assert.equal(packageJson.build.icon, "favicon-inverted.png");
  assert.equal(packageJson.build.files.includes("favicon-inverted.png"), true);
});

test("electron package excludes Chrome extension and Worker build code", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const packagedFiles = packageJson.build.files;

  assert.equal(packagedFiles.includes("electron/**"), true);
  assert.equal(packagedFiles.includes("src/**"), true);
  assert.equal(packagedFiles.includes("manifest.json"), false);
  assert.equal(packagedFiles.includes("options.html"), false);
  assert.equal(packagedFiles.includes("worker/**"), false);
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
  assert.equal(fs.existsSync(path.join(repoRoot, "worker")), false);
  assert.equal(
    packageJson.scripts.check,
    "node --check src/session-state.js && node --check src/electron-tabs.js && node --check electron/main.js && node --check electron/preload.js && node --check electron/renderer.js && node --check electron/tab-search.js",
  );
});

test("Makefile can create a Windows code-signing certificate", () => {
  const makefile = readRepoFile("Makefile");

  assert.match(makefile, /\.PHONY: windows-code-sign-cert/);
  assert.match(makefile, /New-SelfSignedCertificate/);
  assert.match(makefile, /-Type CodeSigningCert/);
  assert.match(makefile, /RandomNumberGenerator/);
  assert.match(makefile, /Export-PfxCertificate/);
  assert.match(makefile, /CSC_LINK=.*CSC_KEY_PASSWORD=.*npm run dist:win/);
});

test("Makefile can sign a Windows executable with the generated certificate", () => {
  const makefile = readRepoFile("Makefile");

  assert.match(makefile, /\.PHONY: windows-sign-exe/);
  assert.match(makefile, /WINDOWS_SIGN_EXE \?=/);
  assert.match(makefile, /Get-ChildItem 'dist' -Recurse -Filter '\*\.exe'/);
  assert.match(makefile, /signtool\.exe/);
  assert.match(makefile, /Set-AuthenticodeSignature/);
  assert.match(makefile, /Cert:\\CurrentUser\\My/);
  assert.match(makefile, /SignerCertificate/);
  assert.match(makefile, /Export-PfxCertificate/);
  assert.match(makefile, /\/f/);
  assert.match(makefile, /\/p/);
  assert.match(makefile, /'\/fd', 'SHA256'/);
  assert.match(makefile, /'\/td', 'SHA256'/);
});

test("renderer shell is a multitab UI without iframe-hosted ChatGPT pages", () => {
  const rendererHtml = readRepoFile("electron", "renderer.html");
  const rendererSource = readRepoFile("electron", "renderer.js");
  const preloadSource = readRepoFile("electron", "preload.js");
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(rendererHtml, /role="tablist"/);
  assert.match(rendererHtml, /class="tab-strip"/);
  assert.match(
    rendererHtml,
    /<div class="tab-cluster">\s*<div class="tab-list"><\/div>\s*<\/div>\s*<div class="tab-actions">\s*<button class="toolbar-button new-tab"/,
  );
  assert.match(rendererHtml, /<div class="tab-actions">/);
  assert.doesNotMatch(rendererHtml, /class="toolbar-button restore-tab"/);
  assert.doesNotMatch(rendererHtml, /open-external/);
  assert.doesNotMatch(rendererSource, /openExternalButton/);
  assert.doesNotMatch(rendererSource, /chatgptTabs\.openExternal/);
  assert.doesNotMatch(preloadSource, /tabs:openExternal/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\("tabs:openExternal"/);
  assert.match(rendererSource, /function renderTabs/);
  assert.match(rendererSource, /chatgptTabs\.createTab/);
  assert.match(rendererSource, /chatgptTabs\.activateTab/);
  assert.doesNotMatch(rendererHtml, /<iframe/i);
  assert.doesNotMatch(rendererSource, /createElement\(['"]iframe['"]\)/);
});

test("electron app provides a topmost tab search palette", () => {
  const mainSource = readRepoFile("electron", "main.js");
  const preloadSource = readRepoFile("electron", "preload.js");
  const rendererSource = readRepoFile("electron", "renderer.js");
  const searchHtml = readRepoFile("electron", "tab-search.html");
  const searchSource = readRepoFile("electron", "tab-search.js");
  const searchStyles = readRepoFile("electron", "tab-search.css");

  assert.match(mainSource, /let tabSearchView = null;/);
  assert.match(mainSource, /function toggleTabSearch\(\)/);
  assert.match(mainSource, /mainWindow\.contentView\.addChildView\(tabSearchView\)/);
  assert.match(mainSource, /view\.setBackgroundColor\("#00000000"\)/);
  assert.match(mainSource, /tabSearchView\.webContents\.send\("tabs:searchOpened"/);
  assert.match(mainSource, /onToggleTabSearch: toggleTabSearch/);
  assert.match(mainSource, /function installApplicationMenu\(\)/);
  assert.match(mainSource, /accelerator:\s*"Command\+Shift\+P"/);
  assert.match(mainSource, /click:\s*\(\) => openTabSearch\(\)/);
  assert.match(mainSource, /Menu\.setApplicationMenu/);
  assert.match(mainSource, /ipcMain\.handle\("tabs:toggleSearch"/);
  assert.match(mainSource, /ipcMain\.handle\("tabs:openSearch"/);
  assert.match(mainSource, /ipcMain\.handle\("tabs:closeSearch"/);
  assert.match(preloadSource, /toggleSearch: \(\) => ipcRenderer\.invoke\("tabs:toggleSearch"\)/);
  assert.match(preloadSource, /openSearch: \(\) => ipcRenderer\.invoke\("tabs:openSearch"\)/);
  assert.match(preloadSource, /closeSearch: \(\) => ipcRenderer\.invoke\("tabs:closeSearch"\)/);
  assert.match(preloadSource, /onSearchOpened:/);
  assert.match(rendererSource, /event\.ctrlKey/);
  assert.match(rendererSource, /event\.code === "Backquote"/);
  assert.match(rendererSource, /function isOpenPaletteShortcut\(event\)/);
  assert.match(rendererSource, /window\.chatgptTabs\.platform === "darwin"/);
  assert.match(rendererSource, /event\.ctrlKey && !event\.metaKey/);
  assert.match(rendererSource, /event\.metaKey && !event\.ctrlKey/);
  assert.match(rendererSource, /isOpenPaletteShortcut\(event\)/);
  assert.match(rendererSource, /window\.chatgptTabs\.openSearch\(\)/);
  assert.match(rendererSource, /window\.chatgptTabs\.toggleSearch\(\)/);
  assert.match(searchHtml, /role="dialog"/);
  assert.match(searchHtml, /class="tab-search-input"/);
  assert.match(searchHtml, /class="tab-search-results"/);
  assert.match(searchSource, /function getMatchingTabs/);
  assert.match(searchSource, /title\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(searchSource, /event\.key === "ArrowDown"/);
  assert.match(searchSource, /event\.key === "ArrowUp"/);
  assert.match(searchSource, /event\.key === "Enter"/);
  assert.match(searchSource, /function isCloseSelectedTabShortcut\(event\)/);
  assert.match(searchSource, /event\.ctrlKey && event\.key === "Delete"/);
  assert.match(searchSource, /window\.chatgptTabs\.platform === "darwin" && event\.metaKey && event\.key === "Backspace"/);
  assert.match(searchSource, /isCloseSelectedTabShortcut\(event\)/);
  assert.match(searchSource, /function isCursorAfterSearchText\(\)/);
  assert.match(searchSource, /input\.selectionStart === input\.value\.length/);
  assert.match(searchSource, /input\.selectionEnd === input\.value\.length/);
  assert.match(searchSource, /event\.key === "Delete" && isCursorAfterSearchText\(\)/);
  assert.match(searchSource, /event\.key === "Escape"/);
  assert.match(searchSource, /event\.ctrlKey && event\.code === "Backquote"/);
  assert.match(searchSource, /let shouldFocusInputAfterRender = false;/);
  assert.match(searchSource, /function focusInputAfterRender\(\)/);
  assert.match(searchSource, /shouldFocusInputAfterRender = true;/);
  assert.match(searchSource, /if \(shouldFocusInputAfterRender\) \{/);
  assert.match(searchSource, /function getActiveTabIndex\(tabs\)/);
  assert.match(searchSource, /selectedIndex = getActiveTabIndex\(tabs\)/);
  assert.match(searchSource, /tab\.isStarred \? "⭐ " : ""/);
  assert.match(searchSource, /window\.chatgptTabs\.activateTab/);
  assert.match(searchSource, /window\.chatgptTabs\.closeTab/);
  assert.match(searchSource, /window\.chatgptTabs\.closeSearch/);
  assert.match(searchStyles, /\.tab-search-panel/);
  assert.match(searchStyles, /\.tab-search-row:hover \.tab-search-close/);
  assert.match(searchStyles, /\.tab-search-row:focus-within \.tab-search-close/);
  assert.doesNotMatch(searchStyles, /\.tab-search-row\[data-active="true"\]\s+\.tab-search-select\s*\{\s*font-weight:/);
});

test("renderer leaves new tab shortcuts to the managed chat webContents", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.doesNotMatch(rendererSource, /String\(event\.key\)\.toLowerCase\(\) === "t"/);
  assert.match(rendererSource, /event\.key === "Tab"/);
  assert.match(rendererSource, /event\.code === "BracketLeft"/);
  assert.match(rendererSource, /event\.code === "BracketRight"/);
  assert.match(rendererSource, /event\.key === "PageUp"/);
  assert.match(rendererSource, /event\.key === "PageDown"/);
});

test("new tab button opens a restore menu on long press", () => {
  const mainSource = readRepoFile("electron", "main.js");
  const preloadSource = readRepoFile("electron", "preload.js");
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(mainSource, /Menu/);
  assert.match(mainSource, /function showNewTabMenu\(\)/);
  assert.match(mainSource, /Menu\.buildFromTemplate\(\[/);
  assert.match(mainSource, /label:\s*"Open a new tab"/);
  assert.match(mainSource, /label:\s*"Re-open the closed tab"/);
  assert.match(mainSource, /enabled:\s*getController\(\)\.getState\(\)\.closedTabs\.length > 0/);
  assert.match(mainSource, /getController\(\)\.getState\(\)\.bookmarkedTabs/);
  assert.match(mainSource, /label:\s*bookmark\.title/);
  assert.match(mainSource, /click:\s*\(\) => getController\(\)\.openBookmarkedTab\(bookmark\.url\)/);
  assert.match(mainSource, /ipcMain\.handle\("tabs:showNewTabMenu"/);
  assert.match(preloadSource, /showNewTabMenu: \(\) => ipcRenderer\.invoke\("tabs:showNewTabMenu"\)/);
  assert.match(rendererSource, /const NEW_TAB_MENU_HOLD_MS = 500;/);
  assert.match(rendererSource, /newTabButton\.addEventListener\("pointerdown"/);
  assert.match(rendererSource, /window\.setTimeout\(\(\) => \{/);
  assert.match(rendererSource, /window\.chatgptTabs\.showNewTabMenu\(\)/);
  assert.match(rendererSource, /newTabButton\.addEventListener\("click"/);
  assert.match(rendererSource, /window\.chatgptTabs\.createTab\(\)/);
  assert.doesNotMatch(rendererSource, /document\.querySelector\("\.restore-tab"\)/);
  assert.doesNotMatch(rendererSource, /restoreTabButton/);
});

test("electron main process does not handle tab shortcuts a second time", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.doesNotMatch(mainSource, /function handleTabShortcut/);
  assert.doesNotMatch(mainSource, /mainWindow\.webContents\.on\("before-input-event"/);
  assert.doesNotMatch(mainSource, /getController\(\)\.closeTab\(getController\(\)\.getActiveTab\(\)\?\.id\)/);
  assert.doesNotMatch(mainSource, /getController\(\)\.getActiveTab\(\)\?\.view\.webContents\.reload\?\.\(\)/);
});

test("electron main process does not register duplicate global tab shortcuts", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.doesNotMatch(mainSource, /CommandOrControl\+T/);
  assert.doesNotMatch(mainSource, /CommandOrControl\+W/);
  assert.doesNotMatch(mainSource, /registerFocusedWindowShortcuts/);
  assert.doesNotMatch(mainSource, /unregisterFocusedWindowShortcuts/);
});

test("only the Electron tab controller owns Ctrl+T and Ctrl+W shortcuts", () => {
  const controllerSource = readRepoFile("src", "electron-tabs.js");
  const nonControllerSource = [
    readRepoFile("electron", "main.js"),
    readRepoFile("electron", "preload.js"),
    readRepoFile("electron", "renderer.js"),
  ].join("\n");

  assert.equal((controllerSource.match(/before-input-event/g) || []).length, 1);
  assert.match(controllerSource, /key === "t"/);
  assert.match(controllerSource, /controller\.createTab\(\)/);
  assert.match(controllerSource, /key === "w"/);
  assert.match(controllerSource, /controller\.closeTab\(tab\.id\)/);

  assert.doesNotMatch(nonControllerSource, /before-input-event/);
  assert.doesNotMatch(nonControllerSource, /CommandOrControl\+(?:T|W)/);
  assert.doesNotMatch(nonControllerSource, /event\.key\s*={2,3}\s*["'][tTwW]["']/);
  assert.doesNotMatch(
    nonControllerSource,
    /(?:event\.)?key(?:\s*\|\|\s*["'])?\.toLowerCase\(\)\s*={2,3}\s*["'][tw]["']/,
  );
  assert.doesNotMatch(nonControllerSource, /case\s+["'][tTwW]["']\s*:/);
});

test("renderer closes a tab on double click", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererSource, /tabList\.addEventListener\("dblclick"/);
  assert.match(rendererSource, /event\.preventDefault\(\);/);
  assert.match(rendererSource, /window\.chatgptTabs\.closeTab\(tabId\);/);
});

test("renderer prevents Windows autoscroll before middle-click closing a tab", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererSource, /tabList\.addEventListener\("mousedown", \(event\) => \{/);
  assert.match(rendererSource, /if \(event\.button !== 1\) \{/);
  assert.match(rendererSource, /event\.preventDefault\(\);/);
  assert.match(rendererSource, /tabList\.addEventListener\("auxclick"/);
  assert.match(rendererSource, /window\.chatgptTabs\.closeTab\(tabId\);/);
});

test("renderer asks the main process to show a tab context menu on right click", () => {
  const preloadSource = readRepoFile("electron", "preload.js");
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(preloadSource, /showTabContextMenu: \(id\) => ipcRenderer\.send\("tabs:showContextMenu", id\)/);
  assert.match(rendererSource, /tabList\.addEventListener\("contextmenu", \(event\) => \{/);
  assert.match(rendererSource, /window\.chatgptTabs\.showTabContextMenu\(tabId\);/);
});

test("electron main process shows grouped target-tab context menu actions", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /ipcMain\.on\("tabs:showContextMenu"/);
  assert.match(
    mainSource,
    /label:\s*tab\.isStarred \? "Unstar this tab" : "Star this tab"[\s\S]*label:\s*controller\.isTabBookmarked\(tabId\) \? "Un-bookmark this tab" : "Bookmark this tab"[\s\S]*type:\s*"separator"[\s\S]*label:\s*"Reload the page"[\s\S]*label:\s*"Copy tab URL"[\s\S]*label:\s*"Open the tab in external browser"[\s\S]*type:\s*"separator"[\s\S]*label:\s*"Close this tab"[\s\S]*label:\s*"Close all tabs on the left"[\s\S]*label:\s*"Close all tabs"/,
  );
  assert.match(mainSource, /controller\.reloadTab\(tabId\)/);
  assert.match(mainSource, /clipboard\.writeText\(tab\.url\)/);
  assert.match(mainSource, /shell\.openExternal\(tab\.url\)/);
  assert.match(mainSource, /const leftTabCount = state\.tabs\.slice\(0, tabIndex\)\.filter\(\(item\) => !item\.isStarred\)\.length/);
  assert.match(mainSource, /const allTabCount = state\.tabs\.filter\(\(item\) => !item\.isStarred\)\.length/);
  assert.match(mainSource, /enabled:\s*leftTabCount > 0/);
  assert.match(mainSource, /enabled:\s*allTabCount > 0/);
});

test("electron app shows and toggles starred tabs from the target-tab context menu", () => {
  const mainSource = readRepoFile("electron", "main.js");
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererSource, /tab\.isStarred \? "⭐ " : ""/);
  assert.match(mainSource, /label:\s*tab\.isStarred \? "Unstar this tab" : "Star this tab"/);
  assert.match(mainSource, /controller\.toggleTabStar\(tabId\)/);
  assert.match(mainSource, /label:\s*controller\.isTabBookmarked\(tabId\) \? "Un-bookmark this tab" : "Bookmark this tab"/);
  assert.match(mainSource, /controller\.toggleTabBookmark\(tabId\)/);
  assert.match(mainSource, /controller\.closeTab\(tabId,\s*\{\s*force:\s*true\s*\}\)/);
});

test("electron main process confirms batch tab context menu closes", () => {
  const mainSource = readRepoFile("electron", "main.js");

  assert.match(mainSource, /dialog/);
  assert.match(mainSource, /function confirmCloseTabs\(/);
  assert.match(mainSource, /dialog\s*\.showMessageBox\(/);
  assert.match(mainSource, /controller\.closeTabsToLeft\(tabId\)/);
  assert.match(mainSource, /controller\.closeAllTabs\(\)/);
  assert.match(mainSource, /buttons:\s*\["Cancel", confirmLabel\]/);
  assert.match(mainSource, /cancelId:\s*0/);
  assert.match(mainSource, /if \(response === 1\)/);
});

test("renderer marks unloaded tabs with a distinct tab strip state", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");
  const rendererStyles = readRepoFile("electron", "renderer.css");

  assert.match(rendererSource, /tabButton\.dataset\.loadedState = tab\.isUnloaded \? "unloaded" : "loaded";/);
  assert.doesNotMatch(rendererStyles, /\.tab\[data-loaded-state="unloaded"\]\s*\{[^}]*background:/);
  assert.doesNotMatch(rendererStyles, /\.tab\[data-loaded-state="unloaded"\] \.tab-title\s*\{[^}]*font-style:\s*italic/);
  assert.match(rendererStyles, /\.tab\[data-loaded-state="unloaded"\] \.tab-title/);
  assert.match(rendererStyles, /color:\s*var\(--muted\)/);
});

test("renderer keeps readable tab widths in a horizontally scrollable tab strip", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");
  const rendererStyles = readRepoFile("electron", "renderer.css");
  const preloadSource = readRepoFile("electron", "preload.js");

  assert.match(preloadSource, /platform:\s*process\.platform/);
  assert.match(rendererSource, /window\.chatgptTabs\.platform === "darwin"/);
  assert.match(rendererStyles, /body\.platform-macos \.tab-strip\s*\{[^}]*padding-left:\s*80px/s);
  assert.match(rendererStyles, /body\.platform-macos \.tab-strip\s*\{[^}]*-webkit-app-region:\s*drag/s);
  assert.match(rendererStyles, /body\.platform-macos \.tab-list,[^{]+\.toolbar-button\s*\{[^}]*-webkit-app-region:\s*no-drag/s);
  assert.match(rendererStyles, /\.tab-list\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(rendererStyles, /\.tab-list\s*\{[^}]*scrollbar-width:\s*none/s);
  assert.match(rendererStyles, /\.tab-list::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
  assert.match(rendererStyles, /\.tab\s*\{[^}]*flex:\s*0 0 150px/s);
  assert.match(rendererStyles, /\.tab\s*\{[^}]*max-width:\s*150px/s);
  assert.match(rendererStyles, /\.tab-cluster::before,\s*\.tab-cluster::after/s);
  assert.match(rendererStyles, /\.tab-cluster::after\s*\{[^}]*width:\s*56px/s);
  assert.match(rendererStyles, /\.tab-cluster::after\s*\{[^}]*right:\s*0/s);
  assert.match(rendererStyles, /\.tab-cluster::after\s*\{[^}]*var\(--page\) 0 14px/s);
  assert.match(rendererStyles, /\.tab-cluster\[data-overflow-left="true"\]::before/s);
  assert.match(rendererStyles, /\.tab-cluster\[data-overflow-right="true"\]::after/s);
  assert.match(rendererStyles, /\.toolbar-button\s*\{[^}]*height:\s*31px/s);
  assert.match(rendererStyles, /\.toolbar-button\s*\{[^}]*margin-bottom:\s*-1px/s);
  assert.match(rendererStyles, /\.toolbar-button\s*\{[^}]*border-bottom:\s*0/s);
  assert.doesNotMatch(rendererStyles, /\.tab-actions \.toolbar-button\s*\{/);
  assert.match(rendererSource, /const tabCluster = document\.querySelector\("\.tab-cluster"\);/);
  assert.match(rendererSource, /function updateTabOverflowIndicators\(\)/);
  assert.match(rendererSource, /tabCluster\.dataset\.overflowLeft = String/);
  assert.match(rendererSource, /tabCluster\.dataset\.overflowRight = String/);
  assert.match(rendererSource, /tabList\.addEventListener\(\s*"wheel"/);
  assert.match(rendererSource, /tabList\.addEventListener\("scroll", updateTabOverflowIndicators\);/);
  assert.match(rendererSource, /const TAB_LIST_WHEEL_SCROLL_MULTIPLIER = 3;/);
  assert.match(rendererSource, /tabList\.scrollBy\(\{\s*left: event\.deltaY \* TAB_LIST_WHEEL_SCROLL_MULTIPLIER,\s*behavior: "smooth",\s*\}\)/s);
  assert.doesNotMatch(rendererSource, /tabList\.scrollLeft \+= event\.deltaY/);
});

test("renderer shell closes the active tab with Command+W on macOS without stealing Command+P or Command+Delete", () => {
  const rendererSource = readRepoFile("electron", "renderer.js");

  assert.match(rendererSource, /event\.metaKey && !event\.ctrlKey && !event\.shiftKey/);
  assert.match(rendererSource, /const key = String\(event\.key \|\| ""\)\.toLowerCase\(\);/);
  assert.match(rendererSource, /key === "w"/);
  assert.match(rendererSource, /window\.chatgptTabs\.closeTab\(currentState\.activeTabId\)/);
  assert.doesNotMatch(rendererSource, /key === "p"/);
  assert.doesNotMatch(rendererSource, /key === "delete"/);
});

test("electron tab controller attaches only the active WebContentsView", () => {
  const {
    createElectronTabController,
    DEFAULT_CONTENT_BOUNDS,
    DEFAULT_CHAT_URL,
  } = require("../src/electron-tabs");

  const attachedViews = [];
  const contentView = {
    addChildView(view) {
      attachedViews.push(view);
    },
    removeChildView(view) {
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
  };

  const createdUrls = [];
  function createView() {
    return {
      bounds: null,
      setBounds(bounds) {
        this.bounds = bounds;
      },
      webContents: {
        loadURL(url) {
          createdUrls.push(url);
        },
        on() {},
      },
    };
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    initialBounds: DEFAULT_CONTENT_BOUNDS,
  });

  const firstTabId = controller.getState().tabs[0].id;
  const firstView = attachedViews[0];
  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  assert.equal(createdUrls[0], DEFAULT_CHAT_URL);
  assert.equal(createdUrls[1], "https://chatgpt.com/c/second");
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], secondTab.view);
  assert.deepEqual(secondTab.view.bounds, DEFAULT_CONTENT_BOUNDS);

  controller.activateTab(firstTabId);

  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], firstView);
});

test("electron tab controller offloads restored startup tabs beyond the latest three", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const attachedViews = [];
  const loadedUrls = [];
  const contentView = {
    addChildView(view) {
      attachedViews.push(view);
    },
    removeChildView(view) {
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
  };

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        close() {},
        focus() {},
      },
    };

    return view;
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    initialState: {
      activeTabId: 5,
      closedTabs: [],
      tabs: [
        { id: 1, title: "One", url: "https://chatgpt.com/c/one" },
        { id: 2, title: "Two", url: "https://chatgpt.com/c/two" },
        { id: 3, title: "Three", url: "https://chatgpt.com/c/three" },
        { id: 4, title: "Four", url: "https://chatgpt.com/c/four" },
        { id: 5, title: "Five", url: "https://chatgpt.com/c/five" },
      ],
    },
  });

  assert.deepEqual(loadedUrls, [
    "https://chatgpt.com/c/three",
    "https://chatgpt.com/c/four",
    "https://chatgpt.com/c/five",
  ]);
  assert.deepEqual(controller.getState().tabs, [
    { id: 1, title: "One", url: "https://chatgpt.com/c/one", isUnloaded: true },
    { id: 2, title: "Two", url: "https://chatgpt.com/c/two", isUnloaded: true },
    { id: 3, title: "Three", url: "https://chatgpt.com/c/three" },
    { id: 4, title: "Four", url: "https://chatgpt.com/c/four" },
    { id: 5, title: "Five", url: "https://chatgpt.com/c/five" },
  ]);
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], controller.getActiveTab().view);

  const firstTab = controller.activateTab(1);

  assert.equal(firstTab.id, 1);
  assert.equal(loadedUrls.at(-1), "https://chatgpt.com/c/one");
  assert.equal(controller.getState().tabs[0].isUnloaded, undefined);
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], firstTab.view);
});

test("electron tab controller counts the active restored tab toward the startup load limit", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const loadedUrls = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    initialState: {
      activeTabId: 1,
      closedTabs: [],
      tabs: [
        { id: 1, title: "One", url: "https://chatgpt.com/c/one" },
        { id: 2, title: "Two", url: "https://chatgpt.com/c/two" },
        { id: 3, title: "Three", url: "https://chatgpt.com/c/three" },
        { id: 4, title: "Four", url: "https://chatgpt.com/c/four" },
        { id: 5, title: "Five", url: "https://chatgpt.com/c/five" },
      ],
    },
  });

  assert.deepEqual(loadedUrls, [
    "https://chatgpt.com/c/one",
    "https://chatgpt.com/c/four",
    "https://chatgpt.com/c/five",
  ]);
  assert.equal(controller.getState().tabs.filter((tab) => tab.isUnloaded !== true).length, 3);
});

test("electron tab controller unloads inactive tabs after thirty minutes", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  let currentTime = 0;
  const intervalHandlers = [];
  const closedViews = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {
          closedViews.push(view);
        },
        focus() {},
      },
    };

    return view;
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    now: () => currentTime,
    setIntervalFn(handler) {
      intervalHandlers.push(handler);
      return intervalHandlers.length;
    },
  });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");
  const firstView = firstTab.view;

  currentTime = 30 * 60 * 1000;
  intervalHandlers[0]();

  assert.equal(closedViews.length, 1);
  assert.equal(closedViews[0], firstView);
  assert.equal(firstTab.view, null);
  assert.equal(controller.getState().tabs[0].isUnloaded, true);
  assert.equal(controller.getState().tabs[1].isUnloaded, undefined);
  assert.equal(secondTab.view.webContents, controller.getActiveTab().view.webContents);

  const reloadedFirstTab = controller.activateTab(firstTab.id);

  assert.equal(controller.getState().tabs[0].isUnloaded, undefined);
  assert.notEqual(reloadedFirstTab.view, closedViews[0]);
});

test("electron tab controller keeps unloaded tab title until ChatGPT publishes a real title", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  let currentTime = 0;
  const intervalHandlers = [];
  const titleHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "page-title-updated") {
            titleHandlers.push(handler);
          }
        },
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({
    contentView,
    createView,
    now: () => currentTime,
    setIntervalFn(handler) {
      intervalHandlers.push(handler);
      return intervalHandlers.length;
    },
  });
  const firstTab = controller.getActiveTab();

  controller.updateTab(firstTab.id, { title: "Saved conversation" });
  controller.createTab("https://chatgpt.com/c/second");

  currentTime = 30 * 60 * 1000;
  intervalHandlers[0]();
  controller.activateTab(firstTab.id);

  titleHandlers.at(-1)(undefined, "ChatGPT");

  assert.equal(controller.getState().tabs[0].title, "Saved conversation");

  titleHandlers.at(-1)(undefined, "Better conversation title");

  assert.equal(controller.getState().tabs[0].title, "Better conversation title");
});

test("electron tab controller focuses the visible WebContentsView when the active tab changes", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };
  const focusedViews = [];

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {
          focusedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();

  assert.equal(focusedViews.at(-1), firstTab.view);

  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  assert.equal(focusedViews.at(-1), secondTab.view);

  controller.activateTab(firstTab.id);

  assert.equal(focusedViews.at(-1), firstTab.view);

  controller.closeTab(firstTab.id);

  assert.equal(focusedViews.at(-1), secondTab.view);
});

test("electron tab controller can restore focus to the active WebContentsView", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };
  const focusedViews = [];

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {
          focusedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  controller.focusActiveTab();

  assert.equal(focusedViews.at(-1), secondTab.view);

  controller.activateTab(firstTab.id);
  controller.focusActiveTab();

  assert.equal(focusedViews.at(-1), firstTab.view);
});

test("electron tab controller reuses the visible main ChatGPT tab for Win+C new-tab requests", () => {
  const { createElectronTabController, DEFAULT_CHAT_URL } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };
  const loadedUrls = [];
  const focusedViews = [];

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        focus() {
          focusedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();

  assert.equal(firstTab.url, DEFAULT_CHAT_URL);
  assert.equal(typeof controller.createTabForNewTabRequest, "function");

  const reusedTab = controller.createTabForNewTabRequest();

  assert.equal(reusedTab, firstTab);
  assert.equal(controller.getState().tabs.length, 1);
  assert.equal(focusedViews.at(-1), firstTab.view);
  assert.deepEqual(loadedUrls, [DEFAULT_CHAT_URL]);

  controller.updateTab(firstTab.id, { url: "https://chatgpt.com/c/existing" });

  const createdTab = controller.createTabForNewTabRequest();

  assert.notEqual(createdTab.id, firstTab.id);
  assert.equal(createdTab.url, DEFAULT_CHAT_URL);
  assert.equal(controller.getState().tabs.length, 2);
  assert.equal(controller.getState().activeTabId, createdTab.id);
  assert.deepEqual(loadedUrls, [DEFAULT_CHAT_URL, DEFAULT_CHAT_URL]);
});

test("electron tab controller opens ChatGPT url requests with the canonical host", () => {
  const { createElectronTabController, DEFAULT_CHAT_URL } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };
  const loadedUrls = [];

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const openedTab = controller.createTabForNewTabRequest("www.chatGPT.com/c/abc?model=gpt-4o");

  assert.equal(openedTab.url, "https://chatgpt.com/c/abc?model=gpt-4o");
  assert.deepEqual(loadedUrls, [DEFAULT_CHAT_URL, "https://chatgpt.com/c/abc?model=gpt-4o"]);
  assert.equal(controller.getState().activeTabId, openedTab.id);
});

test("electron tab controller replaces the last closed tab with a new default tab", () => {
  const { createElectronTabController, DEFAULT_CHAT_URL } = require("../src/electron-tabs");

  const attachedViews = [];
  const closedViews = [];
  const loadedUrls = [];
  const contentView = {
    addChildView(view) {
      attachedViews.push(view);
    },
    removeChildView(view) {
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
  };

  function createView() {
    const view = {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        close() {
          closedViews.push(view);
        },
      },
    };

    return view;
  }

  const controller = createElectronTabController({ contentView, createView });
  const closedTab = controller.getActiveTab();
  const result = controller.closeTab(closedTab.id);
  const state = controller.getState();

  assert.equal(result.id, closedTab.id);
  assert.equal(closedViews[0], closedTab.view);
  assert.deepEqual(state.closedTabs, [
    {
      id: closedTab.id,
      title: "ChatGPT",
      url: DEFAULT_CHAT_URL,
    },
  ]);
  assert.equal(state.tabs.length, 1);
  assert.equal(state.tabs[0].id, closedTab.id + 1);
  assert.equal(state.activeTabId, state.tabs[0].id);
  assert.equal(loadedUrls.at(-1), DEFAULT_CHAT_URL);
  assert.equal(attachedViews.length, 1);
  assert.equal(attachedViews[0], controller.getActiveTab().view);
});

test("electron tab controller reloads a target tab without activating it", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const reloadedUrls = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    let loadedUrl = "";

    return {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrl = url;
        },
        on() {},
        close() {},
        reload() {
          reloadedUrls.push(loadedUrl);
        },
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  const reloadedTab = controller.reloadTab(firstTab.id);

  assert.equal(reloadedTab.id, firstTab.id);
  assert.deepEqual(reloadedUrls, [firstTab.url]);
  assert.equal(controller.getState().activeTabId, secondTab.id);
  assert.equal(controller.reloadTab(999), null);
});

test("electron tab controller closes tabs to the left of a target tab", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");
  const thirdTab = controller.createTab("https://chatgpt.com/c/third");

  const closedTabs = controller.closeTabsToLeft(thirdTab.id);

  assert.deepEqual(closedTabs.map((tab) => tab.id), [firstTab.id, secondTab.id]);
  assert.deepEqual(controller.getState().tabs.map((tab) => tab.id), [thirdTab.id]);
  assert.equal(controller.closeTabsToLeft(thirdTab.id).length, 0);
});

test("electron tab controller persists starred state and protects normal close", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const starredTab = controller.getActiveTab();

  assert.equal(controller.toggleTabStar(starredTab.id).isStarred, true);
  assert.equal(controller.getState().tabs[0].isStarred, true);
  assert.equal(controller.closeTab(starredTab.id), null);
  assert.equal(controller.getState().tabs[0].id, starredTab.id);

  assert.equal(controller.toggleTabStar(starredTab.id).isStarred, false);
  assert.equal("isStarred" in controller.getState().tabs[0], false);

  const restoredController = createElectronTabController({
    contentView,
    createView,
    initialState: {
      activeTabId: 7,
      tabs: [
        {
          id: 7,
          title: "Persisted star",
          url: "https://chatgpt.com/c/persisted-star",
          isStarred: true,
        },
      ],
    },
  });

  assert.equal(restoredController.getState().tabs[0].isStarred, true);
  assert.equal(restoredController.closeTab(7), null);
});

test("electron tab controller skips starred tabs during batch close", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");
  const thirdTab = controller.createTab("https://chatgpt.com/c/third");

  controller.toggleTabStar(secondTab.id);

  assert.deepEqual(controller.closeTabsToLeft(thirdTab.id).map((tab) => tab.id), [firstTab.id]);
  assert.deepEqual(controller.getState().tabs.map((tab) => tab.id), [secondTab.id, thirdTab.id]);
  assert.deepEqual(controller.closeAllTabs().map((tab) => tab.id), [thirdTab.id]);
  assert.deepEqual(controller.getState().tabs.map((tab) => tab.id), [secondTab.id]);
});

test("electron tab controller toggles bookmarks and reopens bookmarked urls", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const loadedUrls = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL(url) {
          loadedUrls.push(url);
        },
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const tab = controller.createTab("https://chatgpt.com/g/g-abc-custom");

  controller.updateTab(tab.id, { title: "Custom GPT" });

  assert.equal(controller.isTabBookmarked(tab.id), false);
  assert.deepEqual(controller.toggleTabBookmark(tab.id), {
    title: "Custom GPT",
    url: "https://chatgpt.com/g/g-abc-custom",
  });
  assert.equal(controller.isTabBookmarked(tab.id), true);
  assert.deepEqual(controller.getState().bookmarkedTabs, [
    { title: "Custom GPT", url: "https://chatgpt.com/g/g-abc-custom" },
  ]);

  const reopenedTab = controller.openBookmarkedTab("https://chatgpt.com/g/g-abc-custom");

  assert.equal(reopenedTab.url, "https://chatgpt.com/g/g-abc-custom");
  assert.equal(controller.getState().activeTabId, reopenedTab.id);
  assert.equal(loadedUrls.at(-1), "https://chatgpt.com/g/g-abc-custom");
  assert.deepEqual(controller.toggleTabBookmark(tab.id), null);
  assert.equal(controller.isTabBookmarked(tab.id), false);
  assert.deepEqual(controller.getState().bookmarkedTabs, []);
});

test("electron tab controller force closes a starred tab without restoring its star", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const starredTab = controller.getActiveTab();

  controller.toggleTabStar(starredTab.id);

  assert.equal(controller.closeTab(starredTab.id, { force: true }).id, starredTab.id);
  assert.equal("isStarred" in controller.getState().closedTabs[0], false);

  const restoredTab = controller.restoreClosedTab();

  assert.equal(restoredTab.id, starredTab.id);
  assert.equal("isStarred" in controller.getState().tabs.at(-1), false);
});

test("electron tab controller restores closed tabs with unique open tab ids", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");
  const closedTab = controller.createTab("https://chatgpt.com/c/third");

  controller.closeTab(closedTab.id);
  const replacementTab = controller.createTab("https://chatgpt.com/c/replacement");
  const restoredTab = controller.restoreClosedTab();
  const openTabIds = controller.getState().tabs.map((tab) => tab.id);

  assert.notEqual(replacementTab.id, closedTab.id);
  assert.equal(restoredTab.id, closedTab.id);
  assert.equal(new Set(openTabIds).size, openTabIds.length);
  assert.equal(controller.getState().activeTabId, restoredTab.id);
});

test("electron tab controller closes all current tabs and keeps a fresh default tab", () => {
  const { createElectronTabController, DEFAULT_CHAT_URL } = require("../src/electron-tabs");

  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on() {},
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  const firstTab = controller.getActiveTab();
  const secondTab = controller.createTab("https://chatgpt.com/c/second");

  const closedTabs = controller.closeAllTabs();
  const state = controller.getState();

  assert.deepEqual(closedTabs.map((tab) => tab.id), [firstTab.id, secondTab.id]);
  assert.equal(state.tabs.length, 1);
  assert.equal(state.tabs[0].url, DEFAULT_CHAT_URL);
  assert.equal(state.activeTabId, state.tabs[0].id);
});

test("electron tab controller handles webContents shortcuts before window defaults", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  let reloadCount = 0;
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        reload() {
          reloadCount += 1;
        },
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");

  let newTabPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        newTabPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "T",
    },
  );

  assert.equal(newTabPrevented, true);
  assert.equal(controller.getState().tabs.length, 3);
  assert.equal(controller.getState().activeTabId, 3);

  let prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "w",
    },
  );

  assert.equal(prevented, true);
  assert.equal(controller.getState().tabs.length, 2);
  assert.equal(controller.getState().activeTabId, 2);

  let nextNewTabPrevented = false;
  beforeInputHandlers[1](
    {
      preventDefault() {
        nextNewTabPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "t",
    },
  );

  assert.equal(nextNewTabPrevented, true);
  assert.equal(controller.getState().tabs.length, 3);
  assert.equal(controller.getState().activeTabId, 4);

  let reloadPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        reloadPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      key: "r",
    },
  );

  assert.equal(reloadPrevented, true);
  assert.equal(reloadCount, 1);
  assert.equal(controller.getState().tabs.length, 3);
});

test("electron tab controller lets macOS content shortcuts pass through while closing tabs with Command+W", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        throw new Error("Command+P must pass through to ChatGPT");
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: false,
      meta: true,
      shift: false,
      key: "p",
      code: "KeyP",
    },
  );

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        throw new Error("Command+Delete must pass through to ChatGPT");
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: false,
      meta: true,
      shift: false,
      key: "Delete",
      code: "Delete",
    },
  );

  let prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: false,
      meta: true,
      shift: false,
      key: "w",
      code: "KeyW",
    },
  );

  assert.equal(prevented, true);
  assert.equal(controller.getState().tabs.length, 1);
  assert.equal(controller.getState().activeTabId, 1);
});

test("electron tab controller opens tab search with Ctrl+Backquote and platform command palette shortcut", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  let toggleCount = 0;
  let openCount = 0;
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        focus() {},
      },
    };
  }

  createElectronTabController({
    contentView,
    createView,
    onToggleTabSearch() {
      toggleCount += 1;
    },
    onOpenTabSearch() {
      openCount += 1;
    },
  });

  let prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: true,
      meta: false,
      key: "`",
      code: "Backquote",
    },
  );

  assert.equal(prevented, true);
  assert.equal(toggleCount, 1);
  assert.equal(openCount, 0);

  prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: true,
      meta: false,
      shift: true,
      key: "P",
      code: "KeyP",
    },
  );

  assert.equal(prevented, true);
  assert.equal(toggleCount, 1);
  assert.equal(openCount, 1);

  prevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        prevented = true;
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: false,
      meta: true,
      shift: true,
      key: "P",
      code: "KeyP",
      platform: "darwin",
    },
  );

  assert.equal(prevented, true);
  assert.equal(toggleCount, 1);
  assert.equal(openCount, 2);

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        throw new Error("Command+Shift+P must pass through outside macOS");
      },
    },
    {
      type: "keyDown",
      alt: false,
      control: false,
      meta: true,
      shift: true,
      key: "P",
      code: "KeyP",
      platform: "win32",
    },
  );

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        throw new Error("key-up must not be prevented");
      },
    },
    {
      type: "keyUp",
      alt: false,
      control: true,
      meta: false,
      key: "`",
      code: "Backquote",
    },
  );

  assert.equal(toggleCount, 1);
  assert.equal(openCount, 2);
});

test("electron tab controller reopens the last closed tab with Command+Shift+T", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  const titleHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }

          if (eventName === "page-title-updated") {
            titleHandlers.push(handler);
          }
        },
        close() {},
        reload() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");
  const closedTab = controller.createTab("https://chatgpt.com/c/third");

  controller.updateTab(closedTab.id, { title: "Saved conversation" });
  controller.closeTab(closedTab.id);

  let reopenPrevented = false;
  beforeInputHandlers[1](
    {
      preventDefault() {
        reopenPrevented = true;
      },
    },
    {
      alt: false,
      control: false,
      meta: true,
      shift: true,
      key: "T",
    },
  );

  const state = controller.getState();

  assert.equal(reopenPrevented, true);
  assert.equal(state.closedTabs.length, 0);
  assert.equal(state.tabs.length, 3);
  assert.equal(state.activeTabId, closedTab.id);
  assert.deepEqual(state.tabs.at(-1), {
    id: closedTab.id,
    title: "Saved conversation",
    url: "https://chatgpt.com/c/third",
  });

  titleHandlers.at(-1)(undefined, "ChatGPT");

  assert.equal(controller.getState().tabs.at(-1).title, "Saved conversation");

  titleHandlers.at(-1)(undefined, "Restored conversation");

  assert.equal(controller.getState().tabs.at(-1).title, "Restored conversation");
});

test("electron tab controller switches tabs with keyboard shortcuts", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        reload() {},
        focus() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  controller.createTab("https://chatgpt.com/c/second");
  controller.createTab("https://chatgpt.com/c/third");

  let nextPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        nextPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      shift: false,
      key: "Tab",
      code: "Tab",
    },
  );

  assert.equal(nextPrevented, true);
  assert.equal(controller.getState().activeTabId, 1);

  let previousPrevented = false;
  beforeInputHandlers[0](
    {
      preventDefault() {
        previousPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      shift: true,
      key: "Tab",
      code: "Tab",
    },
  );

  assert.equal(previousPrevented, true);
  assert.equal(controller.getState().activeTabId, 3);

  let commandBracketPreviousPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        commandBracketPreviousPrevented = true;
      },
    },
    {
      alt: false,
      control: false,
      meta: true,
      shift: true,
      key: "{",
      code: "BracketLeft",
    },
  );

  assert.equal(commandBracketPreviousPrevented, true);
  assert.equal(controller.getState().activeTabId, 2);

  let commandBracketNextPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        commandBracketNextPrevented = true;
      },
    },
    {
      alt: false,
      control: false,
      meta: true,
      shift: true,
      key: "}",
      code: "BracketRight",
    },
  );

  assert.equal(commandBracketNextPrevented, true);
  assert.equal(controller.getState().activeTabId, 3);

  let pageDownPrevented = false;
  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        pageDownPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      shift: false,
      key: "PageDown",
      code: "PageDown",
    },
  );

  assert.equal(pageDownPrevented, true);
  assert.equal(controller.getState().activeTabId, 1);

  let pageUpPrevented = false;
  beforeInputHandlers[0](
    {
      preventDefault() {
        pageUpPrevented = true;
      },
    },
    {
      alt: false,
      control: true,
      meta: false,
      shift: false,
      key: "PageUp",
      code: "PageUp",
    },
  );

  assert.equal(pageUpPrevented, true);
  assert.equal(controller.getState().activeTabId, 3);
});

test("electron tab controller ignores shortcut key-up events", () => {
  const { createElectronTabController } = require("../src/electron-tabs");

  const beforeInputHandlers = [];
  const contentView = {
    addChildView() {},
    removeChildView() {},
  };

  function createView() {
    return {
      setBounds() {},
      webContents: {
        loadURL() {},
        on(eventName, handler) {
          if (eventName === "before-input-event") {
            beforeInputHandlers.push(handler);
          }
        },
        close() {},
        reload() {},
      },
    };
  }

  const controller = createElectronTabController({ contentView, createView });
  let newTabPrevented = false;

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        newTabPrevented = true;
      },
    },
    {
      type: "keyUp",
      alt: false,
      control: true,
      meta: false,
      key: "t",
    },
  );

  assert.equal(newTabPrevented, false);
  assert.equal(controller.getState().tabs.length, 1);

  let closeTabPrevented = false;

  beforeInputHandlers.at(-1)(
    {
      preventDefault() {
        closeTabPrevented = true;
      },
    },
    {
      type: "keyUp",
      alt: false,
      control: true,
      meta: false,
      key: "w",
    },
  );

  assert.equal(closeTabPrevented, false);
  assert.equal(controller.getState().tabs.length, 1);
  assert.equal(controller.getState().closedTabs.length, 0);
});
