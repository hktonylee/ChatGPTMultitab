# ChatGPT Multitab

`ChatGPT Multitab` is a local Electron app for using the official ChatGPT web UI with workspace tab support.

It is lightning fast and provides 100% of the official ChatGPT web UI, because even the official native ChatGPT app does not have all the features of the web UI.

![ChatGPT Multitab screenshot](docs/Screen1.png)

## Why use this?

- The official web UI has the most complete feature set, but you have to rely on the browser to manage multiple instances. It does not have a global hotkey to create a new tab and start asking questions.
- The official native app has better performance, but its functionality lags behind the official web UI, and switching between chat sessions is slow.

## What it does

- Opens official ChatGPT web UI in a dedicated desktop window.
- Global hotkey to open a tab and start a query. Since the page is preloaded, it is faster than using a browser or the official native app. You can typically start typing a prompt in 1-2 seconds.
- Persists open and recently closed tabs in Electron user data.
- Supports `Ctrl+T` or `Cmd+T` for a new tab, `Ctrl+W` or `Cmd+W` to close the active tab, and `Ctrl+Tab` / `Ctrl+Shift+Tab` or `Cmd+Tab` / `Cmd+Shift+Tab` for tab switching.
- Looks like a native app and works like a native app, but it is actually browser instances.

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
