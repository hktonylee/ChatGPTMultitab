# Tab Context Menu Design

## Goal

Right-clicking any tab opens a native Electron context menu for that specific tab.

## Menu

Display actions in this order:

1. `Reload the page`
2. `Open the tab in external browser`
3. Separator
4. `Close this tab`
5. `Close all tabs on the left`
6. `Close all tabs`

`Reload the page` and `Open the tab in external browser` operate on the right-clicked tab, even when it is not active.

Disable `Close all tabs on the left` when the right-clicked tab has no tabs to its left.

## Confirmations

`Close all tabs on the left` and `Close all tabs` show native Electron confirmation dialogs before changing tabs.

- Confirming runs the requested batch close.
- Cancelling leaves all tabs unchanged.
- Dialog text identifies the requested action and number of tabs that will close.

`Close this tab` does not require confirmation.

Closing every tab keeps existing controller behavior: create one new default tab.

## Architecture

- `electron/renderer.js`: listen for `contextmenu` on tab strip and send clicked tab ID through preload.
- `electron/preload.js`: expose tab-context-menu IPC method.
- `electron/main.js`: build native menu, show native confirmation dialogs, reload/open external target tab, dispatch close actions.
- `src/electron-tabs.js`: own batch close operations and tab lookup/state changes.

## Tests

- Renderer forwards right-clicked tab ID.
- Native menu contains exact ordered actions.
- Reload and external-browser actions use right-clicked tab.
- Left-close action is disabled when no tabs exist to left.
- Batch close actions require confirmation; cancel changes nothing.
- Controller closes tabs left of target and closes all tabs while preserving one default tab.
