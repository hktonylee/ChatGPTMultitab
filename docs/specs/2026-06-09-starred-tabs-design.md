# Starred Tabs Design

## Goal

Let users star important tabs so normal close actions cannot remove them. Persist starred state across app restarts.

## Behavior

- Right-clicking a tab shows `Star this tab` or `Unstar this tab`, based on current state.
- Starred tabs show `⭐ ` before their title in the tab strip.
- Close button, middle-click, double-click, search close, shortcuts, `Close all tabs on the left`, and `Close all tabs` leave starred tabs open.
- Right-click `Close this tab` explicitly closes its target, including a starred tab.
- Starred state survives app restart.
- Restored closed tabs are unstarred because only explicit close can place a starred tab in closed-tab history.

## Architecture

- `src/session-state.js` owns stored `isStarred` normalization.
- `src/electron-tabs.js` owns star mutation and close protection.
  - `closeTab(id)` is protected by default.
  - `closeTab(id, { force: true })` bypasses protection for explicit context-menu close.
  - Batch close methods continue using protected close behavior.
- `electron/main.js` adds star/unstar action and uses forced close for `Close this tab`.
- `electron/renderer.js` prefixes starred tab titles with the star emoji.

## Verification

- Session-state tests verify `isStarred` persistence and false-value omission.
- Controller tests verify toggle behavior, protected normal/batch close, and forced close.
- Source-level Electron tests verify star display and context-menu wiring.
- Run focused tests, `npm run check`, then full `npm test`.
