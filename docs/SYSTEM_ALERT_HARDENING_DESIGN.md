# System Alert Hardening Design

Status: Implemented
Date: 2026-06-27

## Scope

This document covers the hardening work triggered by a mostly unconfigured local
Docker walkthrough stack showing repeated operator alerts:

- `Library discovery failed`
- `Metadata artist refresh failed`
- `Metadata refresh needs intervention`

The goal is to keep background work observable while preventing transient or
configuration-related failures from flooding the operator notification panel.

## Official Sources Reviewed

- PostgreSQL `INSERT ... ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html
- PostgreSQL unique indexes: https://www.postgresql.org/docs/current/indexes-unique.html
- PostgreSQL date/time types: https://www.postgresql.org/docs/current/datatype-datetime.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## Findings

The walkthrough alerts were generated from the operator notification read path,
not directly from slskd polling:

1. `AppShell.vue` reads `/api/v1/system/operator-notifications`.
2. `system-routes.js` calls `systemService.getOperatorNotifications`.
3. `operator-notification-service.js` builds alert rows from recent operation
   runs and heartbeat state.
4. The local database contained repeated failed `operation_runs` for
   `library_discovery_dispatch` and `metadata_artist_refresh`.

Two root causes were present:

- Library discovery ran wanted-release reconciliation before provider dispatch.
  The reconciliation query compared `metadata_releases.release_date` (`text`) to
  `operator_artist_monitoring.created_at::date`, producing
  `operator does not exist: text >= date`.
- Metadata artist refresh retries reused the same operation run id and therefore
  the same `job_leases.lease_key`. Because the lease row from the first attempt
  was retained after release, the retry attempted a duplicate unique key insert.

## Recommendations

### Date-Safe Reconciliation

Recommendation: keep `metadata_releases.release_date` as text because
MusicBrainz can provide partial release dates, but normalize comparable
`YYYY`, `YYYY-MM`, and `YYYY-MM-DD` values inside the query before comparing
against monitoring timestamps.

Pros:

- Preserves partial-date metadata fidelity.
- Avoids unsafe casts on malformed or non-full dates.
- Keeps release-scope policy in the existing wanted-release service boundary.

Cons:

- Partial dates are conservative because missing month/day values normalize to
  the first possible date.
- The expression is more verbose than a plain column comparison.

### Retry-Safe Job Lease Acquisition

Recommendation: use PostgreSQL `ON CONFLICT (lease_key) DO UPDATE` for lease
acquisition, but only when the existing lease is released, expired, or already
owned by the same instance.

Pros:

- Makes operation-run retries idempotent.
- Preserves the unique lease-key invariant.
- Avoids stealing another worker's active unexpired lease.

Cons:

- A busy active lease still causes the operation-run wrapper to reject the
  acquisition. That is intentional, but it should remain rare because the queue
  dispatcher already claims one runnable operation at a time.

### Operator Notification Coalescing

Recommendation: coalesce repeated terminal operation-run failures by operation
type, terminal status, and error message, while keeping the latest run reference
as the drilldown target.

Pros:

- Prevents one recurring root cause from filling the alert list.
- Keeps the latest run actionable.
- Preserves separate alerts for distinct failure causes.

Cons:

- Older individual failed runs are no longer first-class rows in the dropdown.
  They remain visible in Background Jobs / operation history.

## Final Recommendation Stack

1. Keep operation-run alerts, but coalesce repeated failures at notification
   build time.
2. Make lease acquisition idempotent for released or expired rows through
   guarded PostgreSQL upsert semantics.
3. Normalize MusicBrainz text release dates before date comparison instead of
   changing the metadata column type.
4. Leave provider-specific setup hints as the next product slice: the current
   change fixes the concrete alert flood, while a follow-up should add explicit
   disabled/setup states for unconfigured providers.

## Outcome

Implemented:

- `job-lease-store.js` now performs guarded `ON CONFLICT` lease acquisition.
- `operation-run-store.js` rejects unavailable leases with a structured
  `operation_run_lease_unavailable` error instead of silently continuing.
- `library-wanted-release-service.js` compares release-scope policy dates
  through a safe comparable date expression.
- `operator-notification-service.js` coalesces repeated operation failures and
  exposes `occurrenceCount` plus `firstOccurredAt` for UI/read-model consumers.

Focused tests cover the new lease behavior, wanted-release SQL expression, and
notification coalescing.
