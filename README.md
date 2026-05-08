# ChatGPT Multitab

`ChatGPT Multitab` is a local Electron app for using the official ChatGPT web UI with workspace tab support.

2026-05-08: Changed from a Chrome plugin into an Electron app.

It keeps multiple ChatGPT pages in one desktop window. Each ChatGPT tab is a real Electron `WebContentsView`, not an iframe, so the app avoids the frame-header and embedded-page issues from the earlier browser-extension version.

![ChatGPT Multitab screenshot](docs/Screen1.png)

## What it does

- Opens ChatGPT in a dedicated desktop window.
- Keeps multiple ChatGPT conversations available as workspace tabs.
- Wraps each ChatGPT page with `WebContentsView` instead of iframe embedding.
- Persists open and recently closed tabs in Electron user data.
- Supports `Ctrl+T` or `Cmd+T` for a new tab, `Ctrl+W` or `Cmd+W` to close the active tab, and `Ctrl+Tab` / `Ctrl+Shift+Tab` or `Cmd+Tab` / `Cmd+Shift+Tab` for tab switching.

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

## Build App Packages

Builds are written to `dist/`.

Windows:

```sh
npm run dist:win
```

### Windows Unknown Publisher Warning

Windows shows `Unknown publisher` when the `.exe` or installer is not signed with a trusted code-signing certificate. This cannot be fixed with Electron code or `package.json` metadata alone.

To show a real publisher name, sign the Windows build with a trusted Windows code-signing identity. The lowest-friction current option is Microsoft Azure Artifact Signing / Trusted Signing. A traditional OV or EV code-signing certificate can also work, but a brand-new signed app may still show a SmartScreen warning until the file or publisher identity builds reputation.

For a local `.pfx` certificate, set signing credentials outside the repo before building:

```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "certificate-password"
npm run dist:win
```

For Windows-specific signing credentials, use `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` instead.

After building, verify the signature:

```powershell
Get-AuthenticodeSignature .\dist\*.exe
```

The status should be `Valid`, and Windows should show the certificate publisher instead of `Unknown publisher`.

macOS:

```sh
npx electron-builder --mac dmg zip
```

Linux:

```sh
npx electron-builder --linux AppImage deb
```

Build Windows packages on Windows, macOS packages on macOS, and Linux packages on Linux for the least friction. Cross-platform builds can require extra system tools such as Wine, code-signing certificates, or platform-specific packaging dependencies.

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
