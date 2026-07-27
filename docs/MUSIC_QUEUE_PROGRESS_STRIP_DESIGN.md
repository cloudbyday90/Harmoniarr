# Music Queue Progress Strip Design

Status: Superseded for Home focus on 2026-07-27

## Purpose

The Music Queue is Harmoniarr's release-progress surface, but a user should not
need to open it merely to learn whether automatic work is happening. This
design adds a compact progress strip to operator Home and monitored Artist
Detail. It gives a clear status and one appropriate handoff while leaving
match, quality, retry, and import decisions in the full Music Queue release
view.

## Research

Official guidance reviewed for this work:

| Source | Finding | Design consequence |
| --- | --- | --- |
| W3C WCAG 2.2, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Dynamic status changes must be available to assistive technology without moving focus. | The strip's concise summary is a polite atomic status region. Polling does not steal focus or open a dialog. |
| W3C ARIA APG, [Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Controls must have a role and visible accessible purpose that matches their effect. | The strip uses links for navigation and does not disguise a workflow mutation as a small dashboard button. |
| W3C ARIA APG, [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Hidden details need an explicit disclosure control and keyboard semantics. | The strip does not reproduce candidate, match, or provider diagnostics. Those remain in the full Music Queue review and advanced diagnostics. |
| W3C WCAG 2.2, [On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus) | Focusing a component must not cause an unexpected context change. | Refreshes and row focus are inert; navigation happens only after explicit link activation. |

These sources were checked against their official pages in July 2026 and are
applicable to the requested June 2026 design baseline.

## Problem

Without a lightweight queue surface, Home shows artist coverage but not the
automatic work it triggered. Artist Detail shows policy and discography but not
whether the selected releases are currently searching, downloading, or stopped.
Opening Activity or the full Music Queue for normal progress creates needless
navigation and makes the product appear manual-first.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Repeat the full Music Queue table on Home and Artist Detail | All detail is immediately available. | Recreates a busy operational screen, duplicates controls, and competes with Artist Policy and discography. | Reject. |
| Put workflow mutations directly on cards and artist pages | Fewer clicks for some exceptional cases. | Context is missing for quality and retry decisions; actions become unsafe and visually noisy. | Reject. |
| Add a compact read-only progress strip with scoped handoffs | Shows automatic work where users already are, preserves release context for repairs, and stays calm. | One additional navigation is required for a repair. | Adopt. |

## Final Recommendation Stack

1. Reuse the authenticated Music Queue read model; do not create a second
   status system.
2. Add an optional `metadataArtistId` filter all the way through the
   user-scoped server read path. The SQL predicate remains parameterized and
   always retains the calling user's ownership predicate.
3. Normalize and prioritize at most three rows in a pure client presentation
   helper: setup and recoverable attention first, then active automatic work.
4. Render the reusable `MusicQueueProgressStrip` on Home only when active or
   attention work, or a refresh error, exists. This avoids an extra all-clear
   dashboard card and prevents idle queue state from competing with real work.
5. Render it for monitored Artist Detail with a small empty state, so an
   artist-specific page explains that nothing is currently waiting without
   claiming a library completion state it cannot prove.
6. Offer only explicit navigation. Home uses one `View details` handoff to the
   release; Artist Detail retains scoped review/setup handoffs. Mutating
   operations remain in release detail behind session, CSRF, ownership, and
   status checks.

## Security And Data Boundary

- The query is bound as a SQL parameter and combined with `app_user_id`.
- The API route continues to require an authenticated session.
- The strip receives the existing sanitized release projection only. It does
  not expose provider response data, source users, remote paths, raw errors,
  or secrets.
- The strip has no mutation endpoint. Existing Music Queue mutations retain
  fresh-session, CSRF, and release-scope enforcement.

## Implementation

- `src/client/lib/music-queue-progress-presentation.js` owns ordering, summary,
  and the one-action row contract.
- `src/client/components/music-queue/MusicQueueProgressStrip.vue` owns the
  compact accessible presentation.
- `useMusicQueue` now supports a reactive artist scope without briefly showing
  a prior artist's data while the scope changes.
- Home receives active or attention global progress; Artist Detail receives the
  parameterized artist scope.
- The existing `GET /api/v1/acquisition/releases` route carries an optional
  `metadataArtistId` filter through the scoped library wanted-release query.

## Verification

- Focused server tests cover route, service, summary service, and SQL store
  filter propagation.
- Client tests cover URL construction and compact priority/action presentation.
- Build and browser verification cover the rendered Home and Artist Detail
  surfaces after the production client bundle is rebuilt.

For the Home refinement, see `MUSIC_QUEUE_HOME_PROGRESS_FOCUS_DESIGN.md`.
