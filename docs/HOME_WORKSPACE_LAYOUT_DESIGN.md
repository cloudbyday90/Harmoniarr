# Home Workspace Layout Design

Status: Implemented and validated
Date: 2026-08-22
Owner: Home operator experience

## Finding

At the supplied 2,752 CSS-pixel browser viewport (1.25 device scale), the
main Harmoniarr workspace measured 2,532 px wide, but Home inherited the
generic `.hx-page` maximum width of 1,480 px. The page was centered, leaving
522 px of unused canvas on each side. The Music Queue and Monitored Artists
panels were also stacked, so the dashboard did not turn a wide desktop into
additional useful operator context.

The generic limit remains appropriate for text-heavy routes. The problem is
specific to Home, which is an operational dashboard containing independent,
compact modules rather than a long-form reading surface.

## Official Source Review

Sources were discovered and reviewed on 2026-08-22:

- [W3C WCAG 2.2 Reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow)
  requires ordinary content to reflow without two-dimensional scrolling at a
  320 CSS-pixel equivalent and describes stacking independent content sections
  as an appropriate responsive pattern.
- [MDN: common CSS Grid layouts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts)
  documents responsive grid patterns that use flexible tracks instead of
  viewport-specific absolute positioning.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Raise the global `.hx-page` limit | Removes whitespace everywhere | Makes text-led pages and release-detail reading lines too wide | Reject |
| Make Home fully edge-to-edge | Maximizes raw panel width | Music Queue rows become too long on ultra-wide displays and header actions are needlessly distant | Reject |
| Leave the 1,480 px cap | Keeps a predictable reading width | Discards more than 40% of the available workspace in the observed desktop state | Reject |
| Scope a 2,200 px cap to Home and pair related panels on wide screens | Uses meaningful width while keeping queue rows close to their existing measure; leaves other routes unchanged | Adds one responsive layout wrapper | Implemented |

## Final Recommendation Stack

1. Keep the global page reading-width default unchanged.
2. Give only the Home dashboard a 2,200 px maximum width, centered within the
   app shell.
3. At 1,400 CSS px and wider, show Music Queue and Monitored Artists as a
   `7fr`/`5fr` CSS Grid workspace. The queue remains the wider operational
   surface; artists use the companion column for dense visual scanning.
4. Below that breakpoint, use one column. This preserves a normal reading
   order, avoids narrow queue rows, and supports zoom and small screens.
5. When there is no active Music Queue panel, let Monitored Artists span the
   whole workspace rather than preserving a blank column.

## Accessibility and Security

- The DOM order remains Music Queue followed by Monitored Artists, so keyboard
  and screen-reader order is unchanged when the visual layout becomes two
  columns.
- The layout uses Grid with flexible `minmax()` tracks, and returns to one
  column below the desktop breakpoint. It adds no fixed page width, horizontal
  scroll region, script, network request, user preference, or persisted data.
- Existing mobile card-grid and queue-row rules remain in force at 640 px and
  below.

## Implementation Outcome

- `OperatorHomePanel.vue` now introduces a semantic workspace wrapper around
  the independently actionable queue and artist panels.
- The Home-only 2,200 px maximum turns the observed unused canvas into a
  bounded dashboard workspace without changing the global `.hx-page` rule.
- The artist panel spans the grid when queue progress is absent.
- The component contract test protects the wide desktop tracks, their
  breakpoint, and the one-panel fallback from accidental removal.

## Validation

- `npm run validate` passed. It includes the Home component contract,
  linting, the full Node test suite, 31 real-PostgreSQL integration tests, and
  a production client/server build.
- The local Compose walkthrough passed configuration validation, then rebuilt
  with `--no-cache`, started healthy, and replayed the documented disposable
  bootstrap helper.
- In the rebuilt app at the observed 2,752 CSS-pixel viewport, Home measured
  2,200 px wide with a 2,152 px workspace: Music Queue measured 1,244 px and
  Monitored Artists 888 px. The browser reported no horizontal page overflow.
- At a 320 px viewport, the same workspace measured 288 px, rendered as one
  column, and reported no horizontal page overflow.

## Next Item

After this layout is released, review real operator dashboards with a dense
artist library and a long Music Queue at desktop, tablet, and 400% zoom. If
the queue needs higher information density, improve its row-level metadata
and filtering before widening it further.
