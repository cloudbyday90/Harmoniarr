# Music Queue Activity Event Coalescing Design

**Status:** Implemented 2026-07-26  
**Scope:** Normal Activity timeline presentation  
**Decision:** Keep the durable Activity ledger intact and project routine
Music Queue milestones into bounded, release-centered stories in the client.

## Problem

Music Queue automation can correctly emit several milestones for one release:
search started, match selected, provider acceptance, download completion, audio
inspection, and library add. Showing every record as a full Activity row makes
the normal timeline read like a worker log instead of household history.

Removing or overwriting durable events would make diagnosis and audit history
worse. The normal timeline needs less visual noise without changing what the
system recorded.

## Research

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  defines events as named occurrences with their own timestamps and structured
  attributes. Its event-name guidance supports preserving distinct lifecycle
  records rather than rewriting them for a particular UI.
- [OpenTelemetry semantic conventions for events](https://opentelemetry.io/docs/specs/semconv/general/events/)
  describes events as meaningful state-change checkpoints in longer asynchronous
  work. Music Queue milestones fit that model, while the Activity UI can choose
  a more compact read presentation.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/#status-messages) requires
  programmatically determinable status updates. The existing Activity status
  region continues to announce the visible story count after each refresh.
- The [HTML Standard disclosure widget](https://html.spec.whatwg.org/dev/interactive-elements.html#the-details-element)
  defines native `details` and `summary` for additional information. A native
  disclosure avoids custom keyboard/ARIA state for condensed milestone details.
- The [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
  reinforces using familiar, semantic interaction patterns with accessible
  names and keyboard behavior.

## Options Considered

### Keep every event as a top-level row

**Pros:** Exact chronological ledger; no projection logic.  
**Cons:** Routine automation overwhelms outcomes, context switches, and
repair actions.  
**Decision:** Reject for the normal Activity view. Raw events remain durable.

### Delete or overwrite earlier milestone records

**Pros:** One row per release in storage.  
**Cons:** Destroys history, races with concurrent writers, complicates audits,
and makes later diagnostics less trustworthy.  
**Decision:** Reject.

### Server-side aggregated feed only

**Pros:** Lower payload and one shared projection.  
**Cons:** Couples a display preference to the feed contract, makes diagnostics
less direct, and requires grouping rules in the authorization/read layer.  
**Decision:** Defer. The current bounded feed is small and already authorized.

### Client-side release-story projection over immutable events

**Pros:** Preserves the durable ledger, scopes the UX change to the normal
timeline, keeps advanced diagnostics independent, and is testable as pure ESM
presentation logic.  
**Cons:** The bounded client feed can only coalesce events it received; a story
may span more than one poll or exceed the limit.  
**Decision:** Adopt.

## Contract

### Release identity

A story may only use a stable wanted-release identifier from
`extraPayload.wantedReleaseId`, or from `entityId` when `entityType` is
`wanted_release`. Import-candidate identifiers never create release stories.

### Coalescible routine milestones

Only normal automatic progress is eligible:

- `music_queue_search_started`
- automatic `music_queue_match_selected`
- `music_queue_download_started`
- `download_completed`
- `music_queue_audio_checked`

An explicit `music_queue_search_queued` and a manual match selection stay
individual because they represent a person’s intentional action.

### Outcome anchors and boundaries

`release_added`, quality stops, audio warnings/failures, no-matches-left, and
terminal download failure remain prominent anchor rows. They can show routine
milestones from the same release that immediately led to that outcome, but are
never hidden by them. Retry and manual-action events are boundaries; Activity
does not infer that they belong to the same automatic cycle.

Stories merge only release-scoped, eligible events within 24 hours of the
newest story event. Invalid or missing timestamps do not merge. This bounds the
projection and prevents old attempts from silently joining a new release run.

### Filters and disclosures

The selected Activity filter applies to raw, authorized events before story
projection. This preserves the meaning of `Downloads`, `Library`, and `Needs
attention` filters. A coalesced story displays its anchor title, its existing
safe handoff, and a native `details` disclosure containing the compact
milestone list in chronological order.

## Security And Accessibility

1. The API and durable event records are unchanged; the client does not mutate
   or delete Activity history.
2. The projection consumes only already-authorized event fields and never
   promotes raw provider paths, source users, provider errors, credentials, or
   candidate payloads into the timeline.
3. Unknown event types remain standalone rather than being guessed into a
   story.
4. The existing polite status region reports visible stories and the raw event
   count after refresh, rather than silently changing the list size.
5. The disclosure uses semantic `details`/`summary`; no custom ARIA expansion
   behavior is introduced.

## Recommendation Stack

1. Retain immutable, named lifecycle events as the durable source of truth.
2. Coalesce only safe automatic milestones with a wanted-release identifier.
3. Keep outcomes, attention states, retries, and explicit user actions as
   visible boundaries.
4. Apply filters before coalescing and preserve existing Music Queue/Library
   handoffs.
5. Use a bounded, semantic disclosure for the hidden steps.

## Implementation And Verification

- Added a pure ESM Activity story projection with stable release identity,
  24-hour bounds, and conservative fallback behavior.
- Updated the timeline to render one release story and an optional native
  milestone disclosure.
- Added unit coverage for automatic grouping, boundaries, filters, invalid
  identities/timestamps, and chronological detail order.
- Added browser coverage that verifies a compact automatic story, disclosure,
  filter behavior, and the Music Queue handoff.

## Next Item

The next high-value item is **Activity information hierarchy cleanup**: reduce
the number of category pills, repeated timestamps, and competing top-level
messages in Activity while preserving the concise timeline, filters, and repair
handoffs. This should be a visual and interaction pass, backed by browser
screenshots at desktop and mobile widths.
