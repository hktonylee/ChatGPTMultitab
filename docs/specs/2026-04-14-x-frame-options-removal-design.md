# ChatGPT Multitab System Extension Design

## Goal

Create an unpacked Chrome extension for a multitab ChatGPT workspace that removes frame-blocking response headers only for user-configured URL patterns. The intended use case is trusted local ChatGPT tab workflows that need to embed pages which set `X-Frame-Options`.

## Scope

In scope:

- Manifest V3 Chrome extension.
- User-configurable URL pattern list.
- Persistent pattern storage using Chrome extension storage.
- Dynamic `declarativeNetRequest` rules that remove `X-Frame-Options`.
- Built-in `chatgpt.com` iframe access rule for the extension workspace that removes frame option headers and frame-blocking CSP headers.
- Documentation for loading and configuring the unpacked extension.

Out of scope:

- Publishing to the Chrome Web Store.
- Syncing settings across browsers.
- Bypassing CSP `frame-ancestors` for arbitrary user-configured patterns; the built-in CSP removal is limited to `chatgpt.com` sub-frame navigations.
- Broad default behavior outside the extension workspace's `chatgpt.com` iframe.

## Architecture

- `manifest.json` declares a Manifest V3 extension with an options page, background service worker, storage permission, `declarativeNetRequestWithHostAccess`, and broad host permissions so user-entered patterns can work.
- `src/rules.js` owns pure rule construction. It normalizes user patterns, assigns stable rule IDs, builds a built-in `chatgpt.com` iframe access rule, and builds dynamic rules that remove frame option headers.
- `src/background.js` reads saved patterns, installs dynamic DNR rules at startup/install, and exposes a message handler so the options page can refresh rules immediately after saving.
- `options.html` and `src/options.js` provide a small settings UI for adding and removing patterns.
- `test/rules.test.js` verifies rule construction without depending on Chrome APIs.

## Data Flow

1. User opens the extension options page.
2. User adds one or more URL patterns, for example `http://localhost:8080/*`.
3. Options page saves patterns to `chrome.storage.local`.
4. Options page sends a message to the background worker to refresh rules.
5. Background worker converts patterns into dynamic DNR rules.
6. Chrome removes `X-Frame-Options` and `Frame-Options` response headers for matching responses and for `chatgpt.com` sub-frame navigations.
7. Chrome also removes `Content-Security-Policy` and `Content-Security-Policy-Report-Only` for built-in `chatgpt.com` sub-frame navigations so `frame-ancestors` cannot block the extension workspace.

## Error Handling

- Empty patterns are ignored.
- Duplicate patterns are collapsed.
- Invalid URL filter strings are rejected by Chrome when rules are installed; the background worker logs the failure.
- The options page reports save failures to the user.

## Acceptance Criteria

- Users can add and remove URL patterns from the options page.
- Patterns persist across browser restarts.
- Saving patterns refreshes dynamic rules without reloading the extension.
- Matching responses have `X-Frame-Options` removed.
- Built-in `chatgpt.com` sub-frame responses have frame option headers and CSP headers removed.
- Non-matching responses are untouched.
- Rule-building behavior is covered by automated tests.

## Verification

- Run the Node test suite for pure rule-building behavior.
- Run a syntax check for JavaScript files.
- Manually load the extension in Chrome and test with a local page if browser verification is needed.
