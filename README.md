# ChatGPT Multitab

`ChatGPT Multitab` is a local Electron app for using the official ChatGPT web UI with workspace tab support.

It keeps multiple ChatGPT pages in one desktop window. Each ChatGPT tab is a real Electron `WebContentsView`, not an iframe, so the app avoids the frame-header and embedded-page issues from the earlier browser-extension version.

## What it does

- Opens ChatGPT in a dedicated desktop window.
- Keeps multiple ChatGPT conversations available as workspace tabs.
- Wraps each ChatGPT page with `WebContentsView` instead of iframe embedding.
- Persists open and recently closed tabs in Electron user data.
- Supports `Ctrl+T` or `Cmd+T` for a new tab, plus `Ctrl+Tab` / `Ctrl+Shift+Tab` or `Cmd+Tab` / `Cmd+Shift+Tab` for tab switching.

You sign in to ChatGPT inside the Electron app. Electron keeps its own browser session, separate from Chrome or Edge.

## Requirements

- Node.js
- npm

## Run locally

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm start
```

The Electron shell renders the tab strip. The ChatGPT pages themselves are attached by the main process as `WebContentsView` children beneath that strip.

## Development

Run tests:

```sh
npm test
```

Run syntax checks:

```sh
npm run check
```

## Project layout

- `electron/main.js`: Electron main process, window setup, `WebContentsView` creation, IPC handlers
- `electron/preload.js`: safe renderer API exposed through `contextBridge`
- `electron/renderer.html`: tab-strip shell
- `electron/renderer.js`: tab UI rendering and keyboard handling
- `electron/renderer.css`: desktop shell styling
- `src/electron-tabs.js`: testable tab and view controller
- `src/session-state.js`: shared tab-session normalization helpers

The older Manifest V3 extension and Cloudflare Worker files are still present while the migration settles, but the supported runtime path is the Electron app.
