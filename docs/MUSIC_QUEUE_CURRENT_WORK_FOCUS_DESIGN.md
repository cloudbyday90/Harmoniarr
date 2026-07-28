# Music Queue Current Work Focus Design

Status: Implemented on 2026-07-28

## Purpose

Music Queue is the normal place to understand what Harmoniarr is doing. Its
default view must therefore prioritize releases moving through search, download,
audio checks, or library add, plus releases that need a decision. Completed,
scheduled, and waiting releases remain useful records, but they should not make
the normal queue look like a backlog requiring manual work.

## Research

Official sources reviewed against the requested June 2026 baseline:

| Source | Finding | Design consequence |
| --- | --- | --- |
| W3C WCAG 2.2, [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keyboard focus order must preserve meaning and operation. | The scope select, search, History link, filter disclosure, and list remain in a straightforward DOM and keyboard order. |
| W3C WCAG 2.2, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Dynamic progress needs accessible status communication without unnecessary interruption. | Existing queue summary status remains concise; changing scope does not move focus or create a modal announcement. |
| Playwright, [Best Practices](https://playwright.dev/docs/best-practices) | Tests should be isolated and assert user-visible outcomes instead of implementation internals. | Browser coverage fixes a deterministic mixed-state queue, verifies the default visible releases, verifies the History destination, and then verifies explicit access to all releases. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Default to every release | Complete data set with no scope switch. | Stable and scheduled state buries active work and makes the page feel manual-first. | Reject. |
| Hide stable releases permanently | Very calm normal view. | Removes legitimate context and makes historical release review harder. | Reject. |
| Default to current work with an explicit all-releases scope and History handoff | Scannable normal workflow while preserving every tracked release and broader history. | One intentional scope change is needed for stable rows. | Adopt. |

## Final Recommendation Stack

1. Reuse the existing immutable active and attention status classifier.
2. Make `Current work` the Music Queue default: active automatic work plus
   releases needing help.
3. Keep `All releases` as an explicit, local presentation option; do not alter
   server reads, ownership boundaries, or durable wanted state.
4. Link `History` directly to Activity History rather than duplicating long-lived
   lifecycle records in the queue list.
5. Preserve direct release detail URLs. A release is never deleted or hidden
   from its URL by the default scope.

## Security And Data Boundary

- This is a client-only projection change over the existing authenticated,
  sanitized Music Queue read model.
- Scope selection does not change database data, release policy, provider state,
  or a release's ownership scope.
- The page continues to expose no provider secrets, raw candidate payloads,
  remote paths, or inline privileged mutations.
- Release-detail actions retain existing fresh-session, CSRF, authorization, and
  release-scope validation on the server.

## Implementation

- `filterMusicQueueReleases` accepts a `scope` option and applies `current`
  using the shared status classifier.
- `MUSIC_QUEUE_SCOPE_FILTERS` centralizes the user-facing scope labels.
- `MusicQueueView` defaults to `Current work`, shows a compact `Show` select,
  and links to Activity History.
- When no release is moving or needs help, the queue explains the state and
  offers `View all releases` rather than presenting an ambiguous empty list.

## Verification

- Client coverage proves `current` includes active and attention releases while
  excluding waiting and library-complete releases.
- Browser coverage proves the default mixed-state list, History handoff, and
  explicit all-releases scope without depending on a real provider.

## Next High-Value Item

Consolidate Music Queue's summary and filter language around the same
`Current work` model: reduce zero-value summary detail, make scheduled automatic
search a secondary status, and verify the page visually at desktop and mobile
widths with a mixed real-world queue fixture.
