# Music Queue Normal-Cycle Activity Visibility

Status: **Implemented 2026-07-26.**

## Objective

After Soulseek is repaired or configured, Music Queue should explain the first
real sign of resumed automation without requiring a visit to advanced
diagnostics. Activity records one release-scoped event only after Soulseek has
accepted a search that was waiting while the provider was unavailable.

This event is not a heartbeat log, provider health alert, search-result count,
or download promise. It means exactly: Harmoniarr started checking for a safe
match again.

## Official Research

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  states that an event name should uniquely identify its structure. The new
  `music_queue_search_started` event has one stable, versioned payload and a
  release-scoped entity instead of rendering arbitrary worker text.
- [OpenTelemetry Logging](https://opentelemetry.io/docs/specs/otel/logs/)
  recommends structured event emission for new first-party systems. The event
  is built by a focused activity presentation service, not at a route or UI
  boundary.
- [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/)
  calls for sanitizing event data and avoiding sensitive data in logs. The
  timeline excludes provider URLs, API keys, usernames, remote file paths,
  raw error messages, and the internal pause marker.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise, programmatically determinable updates. The bounded
  Activity timeline uses a short label and description rather than a noisy
  job-console entry.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Read in-memory heartbeat state when a search starts | Small change. | Loses the repair relationship on restart and can misclassify routine work. | Rejected. |
| Store one global provider-recovered flag | Survives restart. | Cannot identify which release was actually waiting and becomes stale. | Rejected. |
| Emit a row for every heartbeat or search | Complete trace. | Makes Activity noisy and obscures meaningful progress. | Rejected. |
| Store a per-release provider-recovery marker and consume it after provider acceptance | Durable, exact, release-scoped, and quiet. | Requires two small store mutations and tests. | Adopted. |

## Event Contract

| Field | Value |
| --- | --- |
| Event type | `music_queue_search_started` |
| Label | `Searching again: <release> by <artist>` |
| Detail | `Soulseek is available again. Harmoniarr started checking for a safe match.` |
| Category | Downloads |
| Attention | No |
| Handoff | `Open Music Queue` for the same wanted release |

The payload contains only `schemaVersion` and `wantedReleaseId`. It contains no
search ID, provider result, provider failure, provider connection detail,
candidate, remote path, user, or secret.

## Design And Security Rules

1. When the discovery heartbeat sees a non-ready `slskd` dependency, it marks
   only automatic requests that are already due. Future scheduled releases are
   not marked.
2. The marker is an internal `evidence.providerRecoveryPending` record with a
   schema version, provider code, normalized pause code, and timestamp. It is
   persisted with the request and is not returned as Activity payload.
3. When `slskd.startSearch()` succeeds, the dispatcher atomically removes the
   marker by discovery-request ID. Only a successful consume produces the
   Activity event, so normal searches and duplicate worker attempts do not
   create duplicate history rows.
4. The marker is consumed before ingestion, matching, download selection, or
   add-to-library work. A later failure cannot cause the same provider-accepted
   search to be reported again.
5. Marker creation and Activity writing are non-critical. An observability
   failure cannot turn provider setup/unavailability into an additional failed
   discovery run or prevent the provider search from proceeding.
6. A Music Queue handoff still authorizes its own data. The timeline event
   carries no elevated access or provider credential.

## Recommendation Stack

1. Keep provider repair and actual search acceptance separate states.
2. Use durable per-release intent, not global or in-memory recovery state.
3. Emit one sanitized Activity event after the provider accepts a resumed
   search, and no earlier.
4. Reuse the Downloads filter and existing release deep link instead of adding
   a new Activity section or control.
5. Keep raw provider details in authenticated Advanced diagnostics only.

## Implementation And Verification

- Added durable marker/consume methods to
  `library-discovery-request-store.js`.
- Marked only due automatic releases when the dependency policy pauses slskd.
- Wired the marker into startup heartbeat construction and passed the existing
  Activity writer into discovery dispatch.
- Added the `music_queue_search_started` database constraint and Activity
  allowlist entry.
- Added plain-language label, detail, icon, Downloads categorization, and
  release-safe Music Queue handoff.
- Focused tests cover marker SQL scope, one-time consumption, successful
  provider-search ordering, safe payload construction, Activity acceptance,
  timeline presentation, and the release handoff.

## Next Item

The next high-value item is **release-centered Activity event coalescing**:
collapse routine Music Queue milestones such as search started, match selected,
and download started into one compact release story, while keeping the final
library-added or needs-attention outcome prominent. Preserve the existing deep
links and Advanced diagnostics without making the normal Activity timeline a
stream of worker-level events.
