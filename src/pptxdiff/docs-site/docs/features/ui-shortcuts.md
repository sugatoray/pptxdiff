# UI, shortcuts & themes

## Dark mode

A dark/light toggle threads a full theme palette (background, card, border, text, muted, chip colors) through every panel in the app — not just a CSS class swap.

## Keyboard shortcuts

Press `?` any time to open the full shortcuts help modal (closable via `Esc`, click-outside, or ✕). Shortcuts are ignored while focus is in an input, textarea, or contenteditable element.

| Key | Action |
|---|---|
| `A` | Approve |
| `R` | Reject |
| `←` / `→` | Previous / next slide (both sides) |
| `V` | Toggle single/all-pairs view |
| `D` | Toggle dark mode |
| `C` | Jump to single view and focus the comment box |
| `N` | Jump to the next changed slide after the current one |
| `?` | Open the shortcuts help modal |

## Tweaks

The host "Tweaks" panel exposes:

- **`accentColor`** — a color picker for the app's accent color.
- **`wordLevelDiff`** — a boolean toggling the word-level LCS highlighting described in [Diff engine](diff-engine.md) on or off.

## Touch support

Batch-file drag-to-reorder (see [Batch mode](batch-mode.md)) works via both native HTML5 drag-and-drop and touch events, including a floating drag-preview ghost that follows your finger — so reordering works on mobile and tablets, not just desktop pointer devices.

## Accessibility

`aria-label`s are set on icon-only controls (remove-reviewer ✕, per-diff approve/reject ✓/✕, prev/next slide arrows ‹›); toast notifications use `role="status" aria-live="polite"` so they're announced by screen readers without stealing focus.
