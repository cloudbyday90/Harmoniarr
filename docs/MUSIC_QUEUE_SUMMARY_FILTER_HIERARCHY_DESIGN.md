# Music Queue Summary And Filter Hierarchy Design

Status: **Implemented 2026-07-26; superseded by the header-based status hierarchy on 2026-07-28 and the decision-first scope model on 2026-08-23.**

The compact standalone overview described below was a transitional improvement.
`MUSIC_QUEUE_STATUS_HIERARCHY_DESIGN.md` replaces it with one status line in the
queue header and a secondary scheduled-search handoff.

`MUSIC_QUEUE_DECISION_FIRST_WORKSPACE_DESIGN.md` now supersedes the mixed
current-work scope with explicit operator-input, automatic-progress, scheduled,
and all-release scopes.

## Purpose

Music Queue should lead with the release that needs attention or is already
moving through the automatic workflow. The prior six-card summary grid displayed
every status category, including zero values, before the queue itself. On a
phone, those inactive cards could push the first release beyond the initial
viewport. State and type controls were also always visible despite being
secondary to finding a release by name.

## Research

The implementation follows these current official references:

- [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  says keyboard focus should preserve meaning and operability, and recommends
  DOM order reinforce the visual reading order.
- [W3C WCAG 2.2: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  sets a 24 by 24 CSS-pixel minimum target or sufficient separation for pointer
  controls.
- [Apple Human Interface Guidelines: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
  supports list structures that make scanning and drill-down clear.
- [Apple Human Interface Guidelines: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback?changes=_9)
  recommends feedback near the affected item and proportional to its
  significance.

## Options Considered

### Keep all six summary cards

Pros: every category is visible immediately.

Cons: zero-value cards dominate automatic success, consume the mobile viewport,
and duplicate the queue list's responsibility.

### Hide the entire summary

Pros: the first queue row appears sooner.

Cons: removes the useful aggregate signal that a release needs help or that
Harmoniarr is currently downloading or adding music.

### Compact, outcome-first overview with progressive filters

Pros: attention is first, active work remains visible, zero states disappear,
search stays directly available, and State/Type controls are available without
competing with normal scanning.

Cons: a user must open `Filters` to change State or Type. This is appropriate
because these controls refine the list rather than progress music.

## Decision

The initial implementation adopted a `MusicQueueOverview` component backed by
`music-queue-overview-presentation.js`. The later status-hierarchy refinement
replaced both with `music-queue-status-presentation.js` and queue-header copy.

Priority order:

1. `Needs help` and `Needs setup` appear first and visually identify attention.
2. Active `Downloading`, `Ready to add`, and `Searching` work appears next.
3. `Waiting` appears only when no release is actively progressing or blocked.
4. Inactive zero categories are not rendered in the default overview.

The overview is a single compact section, not a grid of dashboard cards. It is
not a control surface and does not expose candidate, provider, path, or run
data.

The queue toolbar keeps name search directly visible. State and release-type
filters are behind a native button-controlled disclosure, with a clear button
only after a filter has changed. DOM order is overview, queue heading/search,
secondary filters, then release rows; this preserves the visual and keyboard
sequence.

## Security And Accessibility

- This is client presentation only. It adds no API, mutation, authorization, or
  provider-data surface.
- Existing native buttons and form controls preserve keyboard operation.
- The filter button declares `aria-expanded` and `aria-controls` for its
  disclosure region.
- Attention is stated as text and supported by color, rather than color alone.
- Existing `hx-btn` controls meet the application target-size convention; the
  browser proof covers mobile width and confirms no horizontal overflow.

## Validation

- `npm run lint:client`
- `npm run lint:test`
- `node --test test/client/music-queue-status-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`

The browser scenario verifies no legacy summary cards render, secondary filters
start hidden and can be expanded/reset, the first queued release is visible in
the initial mobile viewport, and the row review handoff remains intact.

## Follow-up

The next high-value slice is **Music Queue selected-release review hierarchy**.
The list is now calm enough that the right-side review panel is the remaining
densest normal-path surface. Reduce its repeated status/quality blocks while
keeping the one relevant repair action and advanced match evidence discoverable.
