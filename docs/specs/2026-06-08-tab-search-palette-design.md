# Tab Search Palette Design

## Goal

Add a VS Code-style tab search palette opened by `Ctrl+``. It appears at top-center, lists every open tab title, focuses search input immediately, and filters results as user types.

## Interaction

- `Ctrl+`` toggles palette from either active ChatGPT content or shell UI.
- Search uses case-insensitive title substring matching.
- First matching row is selected by default.
- `ArrowUp` and `ArrowDown` move selection.
- `Enter` or row click activates selected tab and closes palette.
- `Escape`, backdrop click, or repeated `Ctrl+`` closes palette.
- Each result row shows small close cross only on row hover or keyboard focus.
- Close cross closes that tab without activating it. Palette stays open, keeps query, refreshes results, and selects nearest remaining result.
- Empty search results show a short message.

## Architecture

`src/electron-tabs.js` remains shortcut owner for active ChatGPT `WebContentsView` instances. On `Ctrl+``, controller prevents default and calls new `onToggleTabSearch` callback.

`electron/main.js` supplies callback and sends `tabs:toggleSearch` to shell renderer. Shell renderer also handles shortcut when shell itself has focus.

`electron/preload.js` exposes toggle event subscription. Existing state-change and tab mutation APIs supply titles, activation, and close behavior.

`electron/renderer.html`, `electron/renderer.css`, and `electron/renderer.js` own overlay markup, styling, filtering, keyboard navigation, activation, and close-row behavior.

## Visual Direction

Refined utilitarian palette matching existing light, cool-neutral tab strip. Compact top-center panel, crisp borders, restrained shadow, clear selected-row tint. Backdrop lightly dims ChatGPT content without obscuring context.

## Accessibility

- Dialog has accessible label.
- Search input has visible placeholder and programmatic label.
- Results use listbox/option semantics.
- Selection uses `aria-selected`.
- Close controls have title-specific labels.
- Focus returns to active ChatGPT tab after palette closes or activation completes.

## Testing

- Source-level Electron tests verify overlay structure, filtering/keyboard/close behavior hooks, preload toggle subscription, main-process event routing, and controller shortcut callback.
- Controller behavior test verifies `Ctrl+`` prevents default and toggles search while ignoring key-up.
- Run focused new tests, `npm run check`, then full `npm test` while reporting existing unrelated baseline failures separately.
