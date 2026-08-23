# Music Queue Conditional Release Inspector Design

Status: Adopted 2026-08-23

## Purpose

Music Queue is list-first until an operator opens a release. The previous
desktop layout permanently reserved a 320–420px details column, even when no
release was selected. That empty state made the primary list unnecessarily
narrow and invited generic copy instead of an actionable task.

This change keeps the existing release-centric workflow: choose a row action,
inspect the release, and take the available safe action. It removes the
unselected inspector altogether, rather than replacing it with a prompt such
as `Needs review` or `Needs your input`.

## Official Research

Official W3C/WAI sources were rechecked on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | W3C recommends the current WCAG version for accessibility work; WCAG 2.2 includes Reflow and Focus Not Obscured. | The unselected queue has one responsive list column. The selected inspector stacks below it at narrow widths, preserving a usable reading and focus path. |
| [Understanding Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Keyboard focus must remain at least partly visible. | Selecting a row retains focus on its action while the sibling inspector appears; the inspector does not take focus unexpectedly. |
| [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | A button that reveals supplementary content communicates its state with `aria-expanded`; `aria-controls` can identify the revealed region. | The selected row action exposes `aria-expanded="true"` and identifies the mounted inspector. Unselected actions do not claim to control an inspector that is not in the DOM. |
| [WAI-ARIA Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | A modal dialog makes content outside it inert and requires managed focus. | Reject a modal. Music Queue remains a master/detail workspace: list filters, other row actions, and navigation remain available while details are open. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep a permanent empty inspector | No conditional rendering. | Narrows the queue without adding a task; repeats generic instructional copy. | Reject. |
| Open details in a modal dialog | Can maximize narrow-screen detail space. | Incorrectly implies the queue behind it is unavailable; requires focus trap/return semantics and interrupts comparison with other releases. | Reject. |
| Conditional non-modal inspector | Gives the list full width until detail is useful, retains deep links and on-page comparison, and works as one column on narrow viewports. | The layout changes when a row is selected; close-origin focus needs a later dedicated refinement. | Adopt. |

## Interaction Contract

```text
No selected release
  -> full-width release list

Row action or release URL
  -> selected release id in the route
  -> list stays visible
  -> release inspector mounts beside the list (or below it on narrow screens)

Close
  -> base Music Queue route
  -> inspector unmounts
  -> list returns to full width
```

The route remains the source of truth for a selected release, so a copied
release URL still opens the same authorized detail. A row activation uses the
existing replacement route behavior and preserves the trigger's browser focus;
opening details does not force focus into a panel that the person did not ask
to enter.

## Implementation Design

- `music-queue-workspace-presentation.js` is a small ESM-only presentation
  module. It normalizes the selected ID and determines whether the inspector
  exists, its stable DOM ID, and the layout mode.
- `MusicQueueView.vue` keeps the list available while detail data loads. It
  applies a second grid column only for a selected release and mounts the
  inspector conditionally.
- `MusicQueueReleaseRow.vue` connects the selected row control to the mounted
  inspector through `aria-expanded` and `aria-controls`.
- `MusicQueueReviewPanel.vue` is only rendered for a selected release. Its
  loading state is local to the inspector and includes a Close action, so a
  slow or failed detail fetch never replaces the queue.

The inspector is a labeled `aside`, not a dialog. It has no modal role,
`aria-modal`, focus trap, or hidden/inert queue content because the adjacent
list remains intentionally operable.

## Security Boundary

This is client presentation only. It creates no endpoint, persistence,
privileged mutation, or new payload field. The existing authenticated,
release-scoped detail route remains authoritative; existing fresh-session,
CSRF, ownership, and safe-add checks remain unchanged. No provider data,
paths, diagnostics, or secrets move into the list or inspector.

## Validation Plan

- Unit-test the ESM workspace presentation for absent, blank, and selected
  release IDs.
- Verify the view contract keeps the list mounted during a selected-detail
  fetch.
- Browser-test the full-width unselected state, selected two-column state,
  `aria-expanded`/`aria-controls` relationship, retained opening focus, close,
  and mobile no-overflow behavior.
- Run focused lint, client tests, browser verification, and production client
  build before the wider validation decision.

## Final Recommendation Stack

1. Use a conditional, non-modal release inspector; keep the unselected Music
   Queue list full width.
2. Keep the queue list visible during a detail fetch and announce loading only
   in the selected inspector.
3. Use semantic button state and a stable inspector ID instead of generic
   empty-state instructions.
4. Keep detailed release actions and evidence inside the inspector; retain the
   existing server-side authorization and mutation checks.

## Next Item

Implement origin-aware focus handling for selected details: preserve row focus
for a list activation, restore it after Close, and give a direct release URL a
clear inspector-heading focus target after its data is ready. This requires a
small, explicit focus-origin module so route navigation never guesses which
element should regain focus.
