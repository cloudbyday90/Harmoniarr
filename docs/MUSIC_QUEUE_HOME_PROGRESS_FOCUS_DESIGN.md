# Music Queue Home Progress Focus Design

Status: Implemented on 2026-07-27

## Purpose

Home should reassure a household user that Harmoniarr is working, or show the
small number of releases that need a decision. It should not restate completed
library state, queued future work, match diagnostics, or provider internals.

This change narrows the existing Home Music Queue card to releases that are
actively moving or need a person. Every row uses one `View details` link to
the release detail. The full Music Queue remains the place for richer status
and a monitored Artist Detail remains an artist-scoped overview.

## Research

Official guidance reviewed against the requested June 2026 baseline:

| Source | Finding | Design consequence |
| --- | --- | --- |
| W3C WCAG 2.2, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Progress and status updates should be programmatically available without moving focus; overly chatty live regions are a risk. | The Home summary remains one polite, atomic status message. It does not announce every row update or move focus after polling. |
| W3C ARIA APG, [Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/) | A link is the correct control when activation navigates to a new resource or location. | Home exposes `View details` as navigation rather than an ambiguous action button or an inline workflow mutation. |
| Playwright, [Best Practices](https://playwright.dev/docs/best-practices) | Browser tests should assert user-visible behavior, isolate data, and mock dependencies outside the product's control. | The browser contract supplies deterministic queue rows, verifies the visible Home card and the release URL, and avoids a live provider dependency. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Show every Music Queue state on Home | Complete snapshot in one place. | Completed and waiting rows bury the work that matters and make Home feel like an operations table. | Reject. |
| Hide the entire card unless an item needs a person | Calm for healthy automation. | A user cannot see that a search, download, or library add is making normal progress. | Reject. |
| Show active automatic work and attention states only | Keeps Home calm while making real progress and exceptions visible. | The full queue is still one navigation away. | Adopt. |

## Final Recommendation Stack

1. Share a pure client status classifier between polling and Home visibility.
2. Define active work narrowly: search, match checking, fallback selection,
   download, ready-to-add, and library add states.
3. Define attention explicitly: setup, quality decision, match choice,
   exhausted matches, transfer failure, and add-to-library recovery.
4. Exclude stable `in_library` and idle/scheduled states from Home; they remain
   readable in Music Queue and Artist Detail where the added context is useful.
5. Give Home one release-detail handoff per row. Release detail owns any safe
   mutation and all validation, authorization, CSRF, and status checks.

## Security And Data Boundary

- The change is client-side presentation over the existing authenticated,
  sanitized Music Queue read model; it adds no API route or browser secret.
- Home has no provider, candidate, remote-path, or raw-error details.
- `View details` is a normal router navigation to an existing release-scoped
  page. Workflow mutations stay behind existing server authorization and CSRF
  enforcement.

## Implementation

- `src/client/lib/music-queue-progress-state.js` owns the immutable active and
  attention status groups plus release classifiers.
- `useMusicQueue` reuses the active classifier for polling, so Home visibility
  and automatic refresh cannot drift.
- `MusicQueueProgressStrip` accepts explicit presentation options instead of
  duplicating a second Home-only component.
- `OperatorHomePanel` enables the focused mode and uses a direct release-detail
  handoff. Artist Detail retains its broader scoped progress behavior.

## Verification

- Client presentation coverage proves idle and completed rows are omitted in
  focused mode, attention is prioritized, and Home actions target release
  detail.
- Browser coverage intercepts the scoped Music Queue API, verifies the active
  release is visible on Home, verifies the idle release is absent, and checks
  the direct release URL.

## Next High-Value Item

Make the normal Music Queue list match this same hierarchy: default to active
and attention releases, move stable completed/history states behind a compact
filter or History handoff, and preserve a direct release-detail route for each
row.
