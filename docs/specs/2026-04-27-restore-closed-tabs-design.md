# Restore Closed Tabs Design

## Goal

Add an undo-style toolbar button next to the existing `Open active chat in new browser tab` control so users can restore recently closed chat tabs. Repeated clicks should restore multiple closed tabs one by one in reverse close order.

## Scope

- Add a restore button in the top-right tab toolbar.
- Track recently closed tabs as a stack.
- Persist the closed-tab stack with the existing workspace session in `localStorage`.
- Restore one tab per click using last-in, first-out behavior.
- Disable the restore control when there is nothing to restore.

## Out of Scope

- Restoring exact historical tab positions.
- Restoring more than one tab from a single click.
- Adding a menu of recently closed tabs.

## Approach

### Session model

The stored workspace session currently contains `activeTabId` and `tabs`. It will grow to include `closedTabs`, which is an array of serialized tab snapshots shaped like the existing tab state:

- `id`
- `title`
- `url`

Normalization rules:

- invalid or missing `closedTabs` falls back to an empty array
- each stored closed tab is sanitized with the same title and URL rules as open tabs
- `nextTabId` continues to advance from the highest known open tab id so restored tabs keep their original ids without colliding

### Closing and restoring tabs

When a tab closes, the workspace will push its current serialized tab state onto `closedTabs` before removing it from the DOM. This applies to existing close flows such as middle click and double click.

When the restore button is clicked:

1. pop the most recently closed tab from `closedTabs`
2. recreate the tab and panel from the stored snapshot
3. insert the tab before the `+` button, matching the current tab creation pattern
4. activate the restored tab
5. persist the updated session

If `closedTabs` is empty, the button stays disabled and clicking has no effect.

### UI behavior

The tab bar already places toolbar buttons on the right edge. The new restore control will sit beside the existing open-in-browser control and use the same `toolbar-button` styling.

The button will:

- use a compact undo glyph
- expose an accessible label and title for restoring the most recently closed chat tab
- reflect availability through the `disabled` attribute

## Testing

Add test-first coverage in `test/index.test.js` for:

- persisted session state sanitizing `closedTabs`
- workspace markup and script including the restore button and disabled-state updater
- restore behavior using a persisted closed-tab stack in reverse close order

Keep the tests aligned with the existing pattern of asserting on inline workspace source and helper behavior.

## Risks

- Older stored sessions do not contain `closedTabs`. This is handled by defaulting to an empty array.
- Reusing stored tab ids could collide if normalization is loose. This is contained by continuing to derive `nextTabId` from the highest open tab id.
