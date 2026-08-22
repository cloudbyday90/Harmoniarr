# Artist Detail Cache Paired-Sample Comparison

Status: Implemented and validated
Date: 2026-08-22

## Purpose

The existing cache baseline capture records a normalized point-in-time view, but
requires an operator to manually compare two captures. This document defines a
small, process-local paired-sample comparison in the Metadata administration
view. It is an observation aid for the existing server-side stale-while-
revalidate (SWR) caches; it does not tune cache policy or add telemetry
infrastructure.

The comparison is intentionally limited to two samples from the same server
process observation window. It will not persist samples, accept pasted capture
text, call a new API, or aggregate data across instances.

## Official Source Review

- OpenTelemetry's [Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  defines a cumulative metric stream as sharing a start time. That boundary is
  required to identify restarts and calculate meaningful interval changes.
- The OpenTelemetry [Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
  guidance distinguishes aggregations from individual events. The existing
  cache counters are aggregates, so the UI must preserve their process window
  rather than pretend they are durable event records.
- OWASP's [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises against collecting unnecessary or sensitive data. A local normalized
  sample avoids adding a new copy, import, or storage surface for diagnostic
  data.
- W3C [WAI-ARIA](https://www.w3.org/TR/wai-aria/) defines `status` as a polite
  advisory live region. The comparison actions and outcomes use concise status
  feedback rather than relying only on a visual state change.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Persist paired samples in PostgreSQL | Survives navigation and restarts; supports history | Adds data retention, schema, authorization, and cleanup concerns before a concrete tuning decision | Reject for now |
| Accept pasted baseline text | Could compare copied samples across sessions | Requires parsing untrusted input and makes process continuity ambiguous | Reject |
| Hold one normalized sample in the active admin view | Minimal attack surface; zero schema/API work; directly supports a controlled test | Does not survive a reload or restart | Accept |
| Add OpenTelemetry collector or fleet dashboard now | Enables centralized aggregation | Premature for the documented single-instance topology and unmeasured need | Defer |

## Final Recommendation Stack

1. Keep the existing server-side SWR cache and fresh-admin diagnostic route.
2. Let an administrator explicitly mark the current normalized cache baseline
   as the comparison start, held only in Vue memory.
3. Compare only when both samples have the same `observedSinceAt` process
   boundary and monotonic counters have not regressed.
4. Derive aggregate and per-namespace interval deltas with a pure ES module.
5. Retain the existing copy action for an approved external record, but never
   import that text back into the application.
6. Use real paired samples to identify a specific cache-policy change before
   changing TTLs, adding persistence, or introducing a collector or lease.

## Security and Data Handling

- The comparison start is held only in component memory. It is not written to
  local storage, session storage, IndexedDB, the clipboard, the API, logs, or
  PostgreSQL.
- The implementation accepts no user-provided sample text and adds no parser.
- A changed process boundary, missing boundary, reversed sample order, or
  decreasing counter makes the comparison unavailable instead of presenting a
  misleading delta.
- The feature consumes the existing normalized diagnostic presentation. It
  does not reveal raw provider errors, credentials, request input, or cache
  payloads.
- The existing fresh-admin route remains the authorization and no-store
  boundary. This client feature does not weaken it.

## Operator Workflow

1. Load the cache baseline from the Metadata administration view.
2. Mark the comparison start after an ordinary load.
3. Exercise the artist detail path that needs investigation, such as
   Discography or related artists.
4. Refresh the baseline and inspect interval deltas only when the process
   window is unchanged.
5. Clear the comparison start when the investigation ends. If the process
   changes, begin a new pair after the next ordinary load.

## Open Pull Request Review

The repository had no open pull requests on 2026-08-22, so there was no
applicable PR to apply locally. No remote branch was merged as part of this
work.

## Implementation Outcome

Implemented on 2026-08-22.

- `metadata-provider-cache-baseline-comparison.js` is a pure ES module that
  snapshots only normalized aggregate counters, validates the process boundary,
  rejects reversed samples and counter regressions, and calculates safe total
  and cache-namespace deltas.
- `useMetadataProviderCacheBaselineComparison` holds exactly one operator-
  initiated start in reactive view memory. It has no local storage, session
  storage, IndexedDB, server API, logging, or import path.
- The administrator-only Metadata baseline panel now supports marking and
  clearing a start, gives polite status feedback, shows aggregate and
  namespace-level interval results, and retains responsive action layout.
- Unit, contract, and browser coverage verify the same-process happy path plus
  changed-window, counter-reset, malformed-boundary, and safe-data handling.

Validation completed successfully:

- `npm run validate` (copyright, migrations and schema checks, ESM/image
  checks, lint, server/client/script/integration tests, and production builds)
- focused browser coverage for the explicit load, copy, mark, refresh, and
  compare workflow
- the local walkthrough Compose image rebuilt, the `harmoniarr` service became
  healthy, and the documented bootstrap helper confirmed the existing local
  administrator

## Next Item

Collect actual paired samples from the controlled operator workflow. Tune the
single-instance cache only when those samples identify a concrete failure mode.
Do not add sample persistence, a telemetry collector, or a distributed lease
until the deployment topology and measured behavior justify it.
