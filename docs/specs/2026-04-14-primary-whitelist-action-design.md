# Primary Whitelist Action Design

## Goal

Change the browser action so clicking the extension icon opens the whitelist management page from already-whitelisted pages, or opens the primary URL from other pages. Add a `Set as primary` control to whitelisted URLs. Setting a URL as primary should also move it to the top of the whitelist.

## Scope

- Remove the action popup behavior from the extension manifest.
- Open `options.html` in a browser tab when the action icon is clicked from a whitelisted page.
- Open the primary URL when the action icon is clicked from a non-whitelisted page and a primary URL is configured.
- Persist a primary whitelisted URL in extension storage.
- Reorder the whitelist so the primary URL is first.
- Render primary state clearly in the whitelist UI.
- Keep existing rule refresh behavior intact.

## Out of Scope

- Changing how header-removal rules are generated.
- Adding wildcard or pattern-based matching.
- Adding import/export for whitelist entries.

## Approach

### Browser action

The extension currently declares `options.html` as a popup. That prevents a normal click handler from running. The manifest will stop declaring a popup, and the background service worker will register `chrome.action.onClicked`.

When the active tab URL exactly matches the whitelist, clicking the action opens the extension options page. When it does not match and a primary URL exists, clicking the action opens the primary URL. When no primary URL exists, clicking the action opens the options page.

### Storage model

The whitelist will continue to use `urlPatterns`. A new `primaryUrl` key will be added in `chrome.storage.local`.

Normalization rules:

- `urlPatterns` remains de-duplicated and trimmed.
- `primaryUrl` must either be empty or one of the stored whitelist URLs.
- If `primaryUrl` exists, the whitelist order is normalized so that URL appears first.
- If the primary URL is removed, `primaryUrl` is cleared.

### Options page behavior

Each whitelist row will show:

- the URL
- current match status
- a primary marker for the current primary URL
- `Set as primary` for non-primary URLs
- `Open`
- `Remove`

When `Set as primary` is clicked:

1. persist the clicked URL as `primaryUrl`
2. reorder `urlPatterns` to move that URL to index `0`
3. refresh the rendered list
4. refresh dynamic rules through the existing background message flow

When the primary row is removed:

1. remove it from `urlPatterns`
2. clear `primaryUrl`
3. refresh the rendered list and rules

## Testing

Use test-first changes for the new state helpers:

- normalizing storage with a valid primary URL moves it to the front
- invalid primary URLs are cleared
- removing the primary URL clears primary state

UI behavior will stay thin and delegate ordering/state decisions to helper functions that can be unit tested without browser APIs.

## Risks

- Chrome action behavior changes between popup and click-handler mode. This is contained to `manifest.json` and `src/background.js`.
- Inconsistent storage state from older installs. This is addressed by normalization during load/save.
