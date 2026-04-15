# ChatGPT Multitab System Extension Design

## Goal

Create an unpacked Chrome extension for a multitab ChatGPT workspace that removes frame-blocking response headers only for user-configured exact URLs. The intended use case is trusted local ChatGPT tab workflows that need to embed pages which set `X-Frame-Options`.

## Scope

In scope:

- Manifest V3 Chrome extension.
- User-configurable exact URL list.
- Persistent URL storage using Chrome extension storage.
- Tab-scoped session `declarativeNetRequest` rules that remove `X-Frame-Options`.
- Built-in `chatgpt.com` iframe access rule for whitelisted top-level tabs that removes frame option headers and frame-blocking CSP headers.
- Documentation for loading and configuring the unpacked extension.

Out of scope:

- Publishing to the Chrome Web Store.
- Syncing settings across browsers.
- Bypassing CSP `frame-ancestors` for arbitrary user-configured URLs; the built-in CSP removal is limited to `chatgpt.com` sub-frame navigations.
- Broad default behavior outside whitelisted top-level pages.

## Architecture

- `manifest.json` declares a Manifest V3 extension with an options page, background service worker, storage permission, `declarativeNetRequestWithHostAccess`, and broad host permissions so user-entered URLs can work.
- `src/rules.js` owns pure rule construction. It normalizes user URLs, assigns stable rule IDs, and builds tab-scoped frame-option and `chatgpt.com` iframe access rules.
- `src/background.js` reads saved URLs, clears stale dynamic DNR rules, installs tab-scoped session DNR rules for all header rewrites, and exposes a message handler so the options page can refresh rules immediately after saving.
- `options.html` and `src/options.js` provide a small settings UI for adding, opening, and removing URLs.
- `test/rules.test.js` verifies rule construction without depending on Chrome APIs.
- `worker/src/worker-response.mjs` serves the optional hosted workspace with anti-framing headers so external sites cannot iframe the whitelisted workspace URL directly.

## Data Flow

1. User opens the extension options page.
2. User adds one or more exact URLs, for example `http://localhost:8080/`.
3. Options page saves URLs to `chrome.storage.local`.
4. Options page sends a message to the background worker to refresh rules.
5. The background worker clears stale dynamic DNR rules.
6. The background worker finds tabs whose top-level URL exactly matches the saved URL list.
7. If no tab matches, Chrome has no active header rewrite or cookie rewrite rules from the extension.
8. If tabs match, Chrome applies frame-option removal and ChatGPT iframe access, including cookie header injection and CSP removal, only in those whitelisted tabs.

## Error Handling

- Empty URLs are ignored.
- Duplicate URLs are collapsed.
- Invalid URL filter strings are rejected by Chrome when rules are installed; the background worker logs the failure.
- The options page reports save failures to the user.

## Acceptance Criteria

- Users can add and remove exact URLs from the options page.
- Patterns persist across browser restarts.
- Saving URLs refreshes session rules without reloading the extension.
- Matching responses have `X-Frame-Options` removed only in whitelisted top-level tabs.
- Built-in `chatgpt.com` sub-frame responses have frame option headers and CSP headers removed only in whitelisted tabs.
- Non-whitelisted top-level pages receive no header rewrite and no cookie rewrite.
- Optional Worker-hosted workspace responses include `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- Rule-building behavior is covered by automated tests.

## Verification

- Run the Node test suite for pure rule-building behavior.
- Run a syntax check for JavaScript files.
- Manually load the extension in Chrome and test with a local page if browser verification is needed.
