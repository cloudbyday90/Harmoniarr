# Music Queue Activity Repair Handoffs

Status: **Implemented 2026-07-26.**

## Purpose

Activity is a compact history of what happened to a release. It is not a second
Music Queue, Downloader, or diagnostics console. This slice completes the
first release-centered milestones that help a home user trust automation:

- a match was selected;
- the download provider accepted the transfer;
- downloaded audio was checked, warned about, or could not be inspected;
- a release reached the library; and
- an owned request is ready.

Each row has at most one useful handoff. A historical event must never require
the user to interpret candidate IDs, operation runs, source users, remote
paths, or raw provider errors.

## Official Research

Research was evaluated against the requested June 2026 baseline.

| Source | Finding applied here |
| --- | --- |
| [W3C ARIA feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | Dynamic activity should expose a clear, bounded item name and description. Harmoniarr retains semantic list/article markup instead of adding the more complex `feed` role because Activity is a bounded history, not an infinite scrolling feed. |
| [WCAG 2.2 Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html) | Equivalent repairs use the same action labels everywhere: `Open Music Queue`, `Review quality choice`, `Check connections`, `Open Library`, and `Open request`. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | A deep link is only navigation. The destination route continues to enforce authorization for every request, and Activity does not expose provider paths, source users, raw errors, or secrets. |

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Client-only links on legacy generic events | Smallest UI change. | Misses durable lifecycle transitions and continues to expose provider-folder subjects in `download_completed`. |
| Mirror raw operation diagnostics into Activity | Detailed implementation evidence. | Noisy, unsafe for a household timeline, and turns Activity into a job console. |
| Release-scoped, sanitized milestone events | Explains automation, supports focused handoffs, and gives durable history without source data. | Requires explicit event types, schema maintenance, and transition-level tests. |

## Recommendation Stack

1. Persist named release milestones only after their owning workflow transition succeeds.
2. Build event entities and payloads through small server-side presentation services, never in routes or Vue components.
3. Use a versioned, bounded payload containing release identity, wanted-release ID when known, candidate ID for correlation, and small counts only.
4. Keep completion events informational and reserve **Needs attention** for audio warnings, unavailable inspection tooling, quality stops, and terminal download stops.
5. Let destination routes authorize their own data. Activity links never grant access or carry provider credentials, paths, usernames, or raw diagnostics.

## Event And Handoff Matrix

| Event | Timeline category | Attention | One handoff |
| --- | --- | --- | --- |
| `music_queue_match_selected` | Downloads | No | Open Music Queue |
| `music_queue_download_started` | Downloads | No | Open Music Queue |
| `download_completed` | Downloads | No | Open Music Queue when the wanted-release ID is available |
| `music_queue_audio_checked` | Audio checks | No | Open Music Queue |
| `music_queue_audio_warning` | Audio checks | Yes | Review quality choice |
| `music_queue_audio_check_failed` | Audio checks | Yes | Check connections |
| `music_queue_quality_blocked` | Audio checks | Yes | Review quality choice |
| `release_added` | Library | No | Open Library |
| `request_fulfilled` | Requests | No | Open request when an owned request ID is available |

`music_queue_quality_blocked` already covers suspicious or transcoded FLAC evidence from the strict lossless gate. It remains separate from generic audio inspection so the user sees a quality decision rather than an ambiguous warning.

## Implementation

- Added `music-queue-milestone-activity-event-service.js` for the release identity and sanitized milestone payload contract.
- Added `request-fulfillment-activity-event-service.js` so request completion retains the existing requester history row and adds a request-detail handoff when the pipeline provides a source request ID.
- Preserved `wantedReleaseId` in Music Queue candidate context. This allows automatic transition events to return to the correct release rather than guessing from a candidate ID.
- Emitted milestones from automatic match selection, manual match selection, accepted download enqueue, download completion reconciliation, and media inspection.
- Replaced the legacy provider-folder `download_completed` subject with the release identity when it is known.
- Routed library-add history to Library and request completion to Request Detail. Existing route/session checks remain the authorization boundary.
- Added the Activity event types to the service allowlist and PostgreSQL check constraint through `20260726_011032_add_music_queue_activity_milestones.sql`.

## Verification

- Unit coverage proves the event payload excludes source usernames and paths, distinguishes audio outcomes, preserves request ownership, and keeps link targets/focus labels consistent.
- Worker coverage proves recovery can record both the failed-match recovery and the accepted replacement transfer without treating either Activity write as a workflow dependency.
- Browser coverage verifies the rendered timeline, attention filter, and the Music Queue, Connections, Library, and Request Detail handoffs.

## Next Item

Move the remaining candidate/import/apply controls behind the existing **Advanced diagnostics** disclosure and remove candidate-first navigation from the ordinary Activity workflow. This is the highest-value remaining Phase 5 item because it completes the separation between user-visible release progress and operator-only evidence.
