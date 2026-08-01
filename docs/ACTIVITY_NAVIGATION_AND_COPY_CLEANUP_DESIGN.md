# Activity Navigation And Copy Cleanup

Status: **Implemented.**

## Goal

Make the normal Activity route a quiet, readable event timeline. Music Queue
owns releases Harmoniarr is working on. Background jobs, raw matches,
library-add records, source records, and system history remain available as
operator diagnostics without competing with the normal music workflow.

## Problem

The primary Activity route already opened the timeline, but several legacy
paths and labels still weakened that boundary:

- `/app/activity/queue` sent an old queue bookmark back to Activity instead of
  the top-level Music Queue.
- Music Queue linked to detailed System history, which made a diagnostic record
  table look like the expected progress destination.
- An operator who followed a direct diagnostic link had no visible route back
  to the normal Activity timeline.
- The global background-jobs indicator called its target a `queue`, even though
  it opens diagnostic operation records, not Music Queue.

Those inconsistencies made Activity look like a collection of hidden tabs and
made Music Queue appear subordinate to Activity.

## Research

Official sources were located and reviewed on 2026-08-01 against the requested
June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [GOV.UK: Navigate a service](https://design-system.service.gov.uk/patterns/navigate-a-service/) | Navigation should expose only important top-level destinations, not a sitemap. A clear journey should be simplified before adding more navigation. |
| [GOV.UK: Tabs](https://design-system.service.gov.uk/components/tabs/) | Do not use tabs as page navigation; they hide destinations and make large workspaces harder to understand. |
| [W3C: Menu structure](https://www.w3.org/WAI/tutorials/menus/structure/) | Navigation labels must be concise and descriptive, and the current destination should remain clear. |
| [W3C: Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep optional specialist content behind a familiar, keyboard-operable disclosure rather than a custom navigation widget. |
| [W3C WCAG 2.2: Bypass blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) | Avoid forcing people through repeated navigation; semantic page structure and clear destinations improve direct access to the main content. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Restore a visible Activity tab bar for Timeline, Queue, History, and diagnostics | Every old destination is immediately discoverable. | Recreates the busy control-centre model and makes Music Queue look like an Activity tab. | Reject. |
| Delete legacy Activity queue and diagnostic routes | The route map is smaller. | Breaks bookmarks, notification targets, and operator handoffs. | Reject. |
| Preserve direct routes, but make timeline and Music Queue the explicit normal destinations | Keeps compatibility and diagnostics while making the home-user path clear. | Direct diagnostic pages need a concise route back to Activity. | **Adopt.** |

## Final Recommendation Stack

1. `/app/activity` and `/app/activity/feed` are the normal Activity timeline.
2. Music Queue is always top-level; the legacy `/app/activity/queue` route
   redirects to `/app/music-queue` while preserving query and hash state.
3. Music Queue links to normal `Activity`, not detailed System history.
4. Direct diagnostic routes retain their URL and put `Back to Activity` in the
   page header.
5. Use `Background jobs` for operation diagnostics. Do not call background job
   records a music queue.
6. Keep advanced controls inside the existing `Advanced diagnostics`
   disclosure. The route map remains authorized and unchanged apart from the
   safe client redirect.

## Implementation

- `ActivityWorkspaceView` renders a `Back to Activity` link only when a direct
  diagnostic route is open.
- `MusicQueueView` replaces its `History` link with `Activity`, targeting the
  default timeline.
- `ActivityHistoryView` uses the precise `System history` title and describes
  itself as detailed troubleshooting records.
- The global jobs indicator says `view background jobs` in its accessible title.
- The legacy Activity queue route preserves its query/hash state while
  redirecting to top-level Music Queue.

## Security And Compatibility

The redirect maps only one fixed legacy client route to the named
`music-queue` route. It does not accept a user-supplied destination, change API
authorization, expose diagnostics data, or widen requester access. Existing
diagnostic URLs and their selected state remain valid.

## Verification

- Browser coverage proves the normal Activity page remains timeline-first.
- It proves direct Match diagnostics exposes `Back to Activity` and returns to
  the timeline.
- It proves legacy `/app/activity/queue` bookmarks preserve query/hash state
  and move to top-level Music Queue.
- Music Queue browser coverage proves its secondary handoff targets
  `/app/activity/feed`, not System history.

## Outcome

Activity is now consistently an event history with optional diagnostics.
Music Queue is no longer represented by an Activity route, tab, or generic
`queue` label.
