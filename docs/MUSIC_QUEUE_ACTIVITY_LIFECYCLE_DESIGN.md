# Music Queue Activity Lifecycle Design

Status: **Implemented 2026-07-25.**

## Problem

Automatic Music Queue recovery already promotes another quality-eligible match
or schedules another search. That work was nearly invisible in the default
Activity timeline. A person could see that a release was not progressing, but
not whether Harmoniarr was retrying safely, trying another match, or waiting to
search again.

Activity must explain meaningful release progress without becoming a second
Music Queue or leaking source-provider diagnostics.

## Official Research

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  defines stable event names, timestamps, severity, and structured attributes.
  Harmoniarr uses a stable `eventType` plus a versioned, bounded payload rather
  than rendering ad-hoc worker text.
- [OpenTelemetry Logging](https://opentelemetry.io/docs/specs/otel/logs/)
  recommends structured event emission for new first-party systems. The
  lifecycle builder is a small reusable boundary used by both worker and
  reconciliation paths.
- [Microsoft transient fault handling guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
  recommends distinguishing transient and terminal failures, tracking retry
  attempts, bounding retry behavior, and testing failure handling. Harmoniarr
  exposes a retry/fallback only after its recovery service has made that
  decision; it exposes a terminal stop only when automatic recovery cannot
  continue.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise, programmatically determinable status updates without
  disruptive focus movement. The existing Activity list and polite refresh
  status remain the presentation mechanism.

## Event Contract

| Event type | Plain-language summary | Attention | Handoff |
| --- | --- | --- | --- |
| `music_queue_search_queued` | Search queued | No | Open Music Queue |
| `music_queue_download_retrying` | Retrying download | No | Open Music Queue |
| `music_queue_match_retrying` | Trying the next best match | No | Open Music Queue |
| `music_queue_no_matches_left` | No good matches left | No when another search is scheduled | Open Music Queue |
| `music_queue_download_failed` | Download needs attention | Yes | Open Music Queue |

All lifecycle events are categorized under the existing **Downloads** timeline
filter. This avoids another top-level filter and keeps the default timeline
compact.

## Payload And Security Boundary

The reusable service at
`src/server/activity/music-queue-lifecycle-activity-event-service.js` emits:

- the known release name and artist when available;
- the wanted-release ID for a safe Music Queue handoff;
- a schema version, stable recovery code, bounded skipped-match count, retry
  timing, and operation-run ID.

It deliberately does not emit a provider username, provider response, remote
folder or filename, raw failure message, API key, filesystem path, or secret.
Those details remain in authenticated advanced diagnostics and operation-run
records. Event recording is non-critical: a failed Activity write cannot undo
an already-persisted recovery or search request.

## Options Considered

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Render raw worker errors in Activity | Fast to implement and detailed. | Exposes noisy provider/path information and makes the history hard to scan. |
| Emit every retry poll | Complete chronology. | Repeats noise and makes Activity look like a job console. |
| Persist meaningful release lifecycle transitions | Explains automation, preserves a small audit history, and has one clear handoff. | Requires an explicit event contract and schema migration. |

## Final Recommendation Stack

1. Use release-scoped, named lifecycle events with a small versioned payload.
2. Emit only after recovery/search state is durably decided.
3. Keep automatic recovery informational; reserve **Needs attention** for a
   terminal automatic stop.
4. Reuse the existing Downloads filter and Music Queue detail route.
5. Keep raw provider and file diagnostics out of Activity.
6. Continue to test worker recovery, transfer reconciliation, client
   presentation, and browser-level filtering/handoff independently.

## Implementation And Verification

- Added the five lifecycle event types to the Activity service allowlist and
  database check constraint.
- Manual **Search again** now records `music_queue_search_queued` only after
  the rediscovery request is saved.
- Worker enqueue failures and reconciled transfer failures now emit one
  lifecycle event from their recovery outcome.
- Client presentation supplies plain labels, concise detail, tone, Downloads
  filtering, terminal attention behavior, and Music Queue handoffs.
- Focused server/client tests and a Playwright Activity scenario cover the
  contract, automatic recovery, terminal state filtering, and safe handoff.

## Next Item

Implement the remaining **Music Queue release progress strip** across Home and
Artist Detail. It should show the same release lifecycle in one compact place
without requiring a visit to Activity, including a clear automatic/needs-help
state and one appropriate action.
