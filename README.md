# ChatGPT Multitab System

Chrome extension for creating a multitab ChatGPT workspace with user-configured frame access rules.

This is intended for trusted local ChatGPT tab workflows. It includes a built-in `chatgpt.com` iframe access rule, removes ChatGPT frame-blocking CSP headers for sub-frame navigations, and removes `X-Frame-Options` response headers for exact URLs you choose.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this project directory.
5. Open the extension details and choose Extension options, or click the extension toolbar button.

For `file://` URLs, open the extension details page and enable Allow access to file URLs.

## Configure

Add one or more exact URLs, then save them from the options page. Examples:

```text
http://localhost:8080/
http://127.0.0.1:5173/some/path/
file:///home/tonylee/example.html
```

The extension removes these response headers for matching main-frame and sub-frame responses so the multitab workspace can load trusted framed pages:

- `X-Frame-Options`
- `Frame-Options`

For `chatgpt.com` iframe navigations, it removes the same frame option response headers, the frame-blocking CSP headers, and these request headers that expose frame/navigation context:

- `Content-Security-Policy`
- `Content-Security-Policy-Report-Only`

- `Sec-Fetch-Dest`
- `Sec-Fetch-Mode`
- `Sec-Fetch-Site`
- `Sec-Fetch-User`
- `Referer`
- `Origin`

## Verify

```sh
npm test
npm run check
```
