# Music Queue Status Hierarchy Design

Status: Implemented on 2026-07-28

## Purpose

The current-work scope correctly removed completed and waiting releases from the
normal queue list, but the page still repeated its state in a standalone
overview panel. That created a second dense surface before the work itself and
gave scheduled searches too much visual weight.

This refinement makes the queue header the single status surface. It leads with
the current decision or active progress, then presents scheduled automatic
search as compact secondary context with one optional handoff.

## Research

Official sources reviewed against the requested June 2026 baseline:

| Source | Finding | Design consequence |
| --- | --- | --- |
| W3C WCAG 2.2, [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Focus order must preserve meaning and operation; DOM order should reinforce the reading order. | Queue heading, status, scheduled-search handoff, controls, then rows stay in DOM order without programmatic focus movement. |
| W3C WCAG 2.2, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Important status changes should be available to assistive technology without interrupting work; excessive live updates are disruptive. | One concise `role="status"` line reports current queue state. Scheduled work is visible plain text, not an alert or repeated notification. |
| W3C WCAG 2.2, [Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html) | Repeated functions should be identified consistently. | `Current work`, `All releases`, `View scheduled releases`, and `History` retain stable, task-oriented names. |
| Playwright, [Best Practices](https://playwright.dev/docs/best-practices) | User-visible outcomes and isolated, deterministic tests provide more durable coverage. | Browser tests use a mixed queue fixture, verify the scheduled-search handoff, and capture desktop/mobile visual evidence without a live provider. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the standalone overview | Retains aggregate counts above the list. | Duplicates current-work context and delays the first actionable row. | Reject. |
| Hide scheduled searches entirely | Maximally calm normal view. | Removes a useful explanation when no current release is visible. | Reject. |
| Put concise status in the list header and expose scheduled work as secondary context | One reading path, clear automation boundary, and an explicit route to inspect scheduled releases. | Aggregate detail is intentionally limited to the work that matters now. | Adopt. |

## Final Recommendation Stack

1. Derive queue status in `music-queue-status-presentation.js`, independent of
   Vue rendering and provider data.
2. Lead with attention; when none exists, lead with active automatic progress.
3. Render no zero-value categories or dashboard-style summary cards.
4. Describe scheduled search only as secondary context. The `View scheduled
   releases` action intentionally switches to `All releases` plus the existing
   `Waiting` filter.
5. Preserve `History`, secondary filters, and direct release-detail routes for
   broader review and diagnostics.

## Security And Accessibility

- This is a client-only projection over the existing authenticated Music Queue
  read model. It adds no provider call, mutation, secret, path, or candidate
  payload.
- The scheduled-search handoff changes local filter state only; it cannot alter
  wanted state, selection, search timing, or provider configuration.
- Status is text, not color alone. Attention rows remain responsible for their
  own specific repair action.
- The concise current-state sentence uses `role="status"` with
  `aria-atomic="true"`; buttons remain outside that live region so interaction
  is not announced as queue status.
- Native controls and the filter disclosure retain their existing keyboard and
  ownership boundaries.

## Implementation

- Replaced `MusicQueueOverview.vue` and its overview presentation module with
  `buildMusicQueueStatusPresentation`.
- Moved current-work summary text into the Music Queue list header.
- Added an explicit scheduled-search handoff that activates `All releases` and
  the existing `Waiting` state filter.
- Prevented scheduled-only queues from repeating the same scheduling sentence
  in both the header and empty state.
- Extended the mixed-state browser proof with desktop and mobile visual
  evidence, including the scheduled-search handoff.

## Verification

- `node --test test/client/music-queue-status-presentation.test.js test/client/acquisition-pipeline-presentation.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`
- `node --test test/browser/music-queue-current-work-browser-verification.test.js test/browser/music-queue-waiting-empty-state-browser-verification.test.js test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`

## Next High-Value Item

Apply the same information-hierarchy audit to **Settings Connections**: reduce
parallel provider-health, setup, and advanced-tuning panels into one setup
state and one routine configuration surface, while retaining explicit Managed,
External, and Disabled provider modes.
