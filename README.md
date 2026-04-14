# Configurable X-Frame-Options Remover

Chrome extension for removing `X-Frame-Options` response headers from user-configured URL patterns.

This is intended for trusted local development workflows. It does not remove CSP `frame-ancestors`, and it does nothing until you add a pattern.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this project directory.
5. Open the extension details and choose Extension options, or click the extension toolbar button.

For `file://` patterns, open the extension details page and enable Allow access to file URLs.

## Configure

Add one or more URL filter patterns, then save them from the options page. Examples:

```text
http://localhost:8080/*
http://127.0.0.1:*/some/path/*
file:///home/tonylee/example.html
```

The extension removes these response headers for matching main-frame and sub-frame responses:

- `X-Frame-Options`
- `Frame-Options`

## Verify

```sh
npm test
npm run check
```
