# Operator Shared-Discovery Correlation Fan-Out

Status: **Implemented.**

Date: 2026-07-30.

This document completes the shared-discovery follow-up from
[MUSIC_QUEUE_STRICT_QUALITY_RELEASE_PROJECTION_DOCKER_EVIDENCE_DESIGN.md](MUSIC_QUEUE_STRICT_QUALITY_RELEASE_PROJECTION_DOCKER_EVIDENCE_DESIGN.md).

## Problem

`library_discovery_requests` deliberately deduplicates provider searches by
metadata release. Before this change, the worker selected one arbitrary
`library_wanted_releases.id` from all operators who wanted that release. The
single ID then became the candidate, recovery, and Activity correlation. Other
operators could see a shared provider result but had no durable release-scoped
outcome or Activity handoff.

The old reconciliation implementation also deleted and recreated both shared
discovery requests and operator wanted rows. That made durable correlations
impossible because IDs were unstable across reconciliation.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [PostgreSQL `SELECT`](https://www.postgresql.org/docs/current/sql-select.html) | `SKIP LOCKED` is appropriate for queue-like consumers and may return an inconsistent view. | Continue locking only the global discovery request while claiming it; resolve the linked operator set in the same claim query without locking unrelated wanted rows. |
| [PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html) | Foreign keys and unique constraints protect cross-table integrity. | Use a junction table with two cascading foreign keys and a composite primary key, rather than JSON arrays or duplicate request rows. |
| [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html) | A transaction sees a consistent committed view appropriate to its isolation level. | Synchronize requests, wanted rows, and their links inside the existing reconciliation transactions. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny by default, validate authorization on every request, and test object-level access. | The correlation table does not create a read authorization path. Existing Music Queue reads continue to require the caller's `appUserId` and return 404 for another operator's wanted-release ID. |
| [Node.js test runner](https://nodejs.org/api/test.html) | The built-in runner supports isolated, promise-based test cases. | Cover the store, shared policy choice, and Activity fan-out with focused ESM `node:test` contracts. |

## Options Considered

### Duplicate one discovery request per operator

Pros: straightforward ownership and per-operator preference evaluation.

Cons: repeats Soulseek searches, candidate ingestion, transfer work, and
provider load for the same release.

Decision: rejected.

### Keep one arbitrary wanted-release ID in request JSON

Pros: no schema change.

Cons: loses ownership correlations, makes Activity incomplete, and allows one
operator's fallback or preference data to influence shared work.

Decision: rejected.

### Shared request plus durable operator link rows

Pros: one provider search and transfer pipeline, stable correlations, clean
cascading cleanup, and a narrow location for operator-local intent.

Cons: reconciliation must preserve row identity and automatic selection needs
a conservative shared policy.

Decision: adopted.

## Final Recommendation Stack

1. Keep one `library_discovery_requests` row per metadata release and one
   provider search per claim.
2. Persist every active missing or partial wanted release in
   `library_discovery_request_wanted_release_links`; do not store redundant
   `app_user_id` because it is authoritatively derived from the wanted row.
3. Replace destructive request and wanted-release reconciliation with upserts
   plus stale-row cleanup, preserving IDs used by deep links and correlations.
4. Claim the global request with its full deterministic linked wanted-release
   set. Persist only release IDs and a shared quality profile on candidates.
5. Aggregate linked preferences to the strictest supported profile:
   `lossless_archive` outranks `high_quality`, which outranks
   `any_available`. A lossless requirement adds `FLAC` to the shared search.
6. Store an operator's fallback-quality choice only on that operator's link.
   Apply it to automatic shared selection only while that link is the sole
   active interest; otherwise the shared conservative policy wins.
7. Fan one shared lifecycle result into one sanitized Activity event for every
   linked wanted release. Keep normal route reads independently scoped.

## Implementation

- Migration `20260730_213104_operator_shared_discovery_correlation.sql` adds
  `library_discovery_request_wanted_release_links` with cascading foreign
  keys, a composite primary key, an inverse lookup index, and a safe backfill.
- `library-discovery-request-wanted-release-link-store.js` owns only link
  synchronization. It removes links that are no longer missing or partial and
  inserts every currently active operator relationship.
- Discovery-request and wanted-release reconciliation now use `ON CONFLICT`
  updates instead of recreating all rows, then synchronize links before their
  transactions commit.
- The claim query returns the full ordered link set. Automatic dispatch loads
  only the linked operators' saved preferences, selects a strict common
  profile, and sends a candidate context with `wantedReleaseIds` but no user
  IDs or per-operator policy data.
- Fallback and search-again intent is recorded on the individual link. The
  shared request retains only shared scheduling state.
- The modular Activity fan-out service expands scoped Music Queue lifecycle
  events at write time. Each persisted row retains only its own wanted-release
  ID; candidate, source-user, path, credential, raw preference data, and
  sibling correlation IDs remain absent from normal Activity payloads.

## Security Boundary

- Database relationships enforce that a link cannot outlive its request or
  wanted release.
- Link synchronization only includes wanted rows in `missing` or `partial`;
  completed and removed interests are excluded from new shared claims. In-flight
  candidates retain their immutable correlation snapshot for truthful history.
- The shared Music Queue candidate context has release IDs and a shared
  profile only. It does not disclose linked account IDs or local fallback
  evidence. Pre-existing delegated-request lineage remains separately scoped
  by its established requested-user authorization rules.
- Existing `getWantedReleaseEvidence({ appUserId, wantedReleaseId })` remains
  the authorization gate for Music Queue detail and actions. A guessed ID from
  another operator still fails with the established 404 behavior.
- Activity is intentionally household history. Fan-out changes release
  correlation, not household feed authorization, and retains the existing
  safe payload allow-list.

## Validation

```text
npm run lint:server
npm run lint:test
node --test test/server/library-discovery-request-store.test.js \
  test/server/library-discovery-request-wanted-release-link-store.test.js \
  test/server/library-wanted-release-store.test.js \
  test/server/library-discovery-dispatch-service.test.js \
  test/server/music-queue-lifecycle-activity-event-service.test.js
node --test --test-concurrency=1 \
  test/integration/operator-shared-discovery-correlation.test.js
npm run migration:check
npm run update:schema-snapshot
npm run check:schema-snapshot
npm run validate:schema-bootstrap
```

The focused contracts prove one two-operator release produces one FLAC-safe
provider search, a shared candidate correlation set, no fallback override
leak, and two release-scoped Activity writes. The Docker integration contract
also applies the migration lineage and executes the claim query itself against
two persisted operator links.

## Next High-Value Item

Add a controlled-provider Docker acceptance scenario with two operator accounts
sharing one wanted metadata release. It should prove one search and one
transfer are created, both scoped Music Queue projections receive the outcome,
cross-operator release reads remain denied, and no user-specific policy fields
appear in candidate or Activity payloads.
