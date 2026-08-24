# Music Queue Shared Selection Guard Design

## Status

Implemented 2026-08-23.

## Problem

The browser already prevents repeated actions for one release in one tab, but
that cannot protect against a second tab, a second Harmoniarr process, an
automatic selection worker, or another household operator selecting a
different candidate at the same time. Two candidates could otherwise enter
the download handoff for one shared discovery search.

Harmoniarr's discovery data is intentionally shared by metadata release.
`library_discovery_requests` owns one search, while
`library_discovery_request_wanted_release_links` associates that search with
every operator-owned wanted-release projection. Import candidates belong to
the search, not to a single operator link. The coordination point is therefore
the shared discovery request, after the route has established the caller owns
the Music Queue release.

## Research

Research was reviewed on 2026-08-23 against the current official sources.

- PostgreSQL's `FOR UPDATE` locking clause locks the selected rows against
  concurrent updates. This suits a short, database-local selection decision.
  [PostgreSQL `SELECT` locking clause](https://www.postgresql.org/docs/current/sql-select.html)
- PostgreSQL locks are meaningful only inside a transaction block, so the
  guard, active-candidate read, status update, and candidate event remain in
  the import-candidate service's existing `BEGIN`/`COMMIT` boundary.
  [PostgreSQL transaction blocks](https://www.postgresql.org/docs/current/sql-start-transaction.html)
- A partial unique index can enforce uniqueness for rows in one table, but it
  cannot express one active candidate per release when the release-to-candidate
  relationship is shared and stored across discovery data. A JSON-path index
  would also incorrectly constrain valid multi-operator links.
  [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- HTTP 409 is the standard response for a request that conflicts with the
  resource's current state and can be resolved by the caller after updating
  that state.
  [RFC 9110 §15.5.10](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.10)

## Options considered

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Browser-only single-flight | Immediate feedback; no database work. | Does not protect another tab, process, worker, or user. Already retained as a usability layer only. |
| PostgreSQL advisory lock | Can coordinate an arbitrary key. | Not self-enforcing, harder to inspect, and unnecessary when the shared discovery row is already the business resource. |
| New selection-claim table with a partial unique index | A durable, declarative invariant. | Requires lifecycle cleanup across failed, applied, and recovery states; easy to mishandle shared candidates and introduce stale claims. |
| Lock the shared discovery request in the existing candidate transition transaction | Uses a real business row, automatically releases at transaction end, covers every normal selection entry point, and requires no migration. | Depends on all selected-status transitions using the import-candidate service; direct SQL writes remain intentionally out of supported application boundaries. |

## Decision

Use the fourth option: a modular selection guard, invoked by the central
`import-candidate-service` whenever a candidate transitions to `selected`.

The guard:

1. Reads the candidate's trusted, persisted `sourceSearchId`.
2. Locks every current `library_discovery_requests` row with that
   `evidence.lastSearchId` using `FOR UPDATE`.
3. Finds another candidate for that shared search in `selected`,
   `downloading`, or `import_pending` status, excluding a retry of the same
   candidate.
4. Returns the existing active state to the service, which emits a stable
   `409 music_queue_candidate_already_active` without exposing the other
   candidate's identity.
5. Otherwise allows the existing guarded status update and
   `import_candidate_events` insert to commit together.

The Music Queue route still performs fresh-session, CSRF, and release
ownership checks before it asks the import-candidate service to select the
candidate. The database lock handles concurrency after that authorization
boundary. Generic import-candidate selection receives the same guard, so
automatic selection, retries, bulk review, and Music Queue actions cannot
diverge.

## Client behaviour

The client keeps its existing per-release single-flight gate. If the server
returns `music_queue_candidate_already_active`, it performs one SWR
revalidation before showing the action feedback. The operator sees the
current download state rather than a stale action list.

## Security and privacy

- The guard never trusts a release or candidate relationship supplied by the
  browser.
- Ownership remains enforced before the selection service is called.
- The conflict response names no other operator and reveals no candidate ID,
  peer, folder, or search payload.
- The critical state transition and its candidate event share one PostgreSQL
  transaction; audit logging remains post-commit diagnostic work, as in the
  established import-candidate service.
- The lock scope is one shared discovery request, so unrelated releases remain
  independently selectable.

## Verification plan

- Unit-test the guard's lock and active-status query.
- Unit-test rollback and stable 409 when the service finds an active selection.
- Use PostgreSQL integration coverage to race two different candidates from a
  shared search while selecting a third candidate for another release.
- Assert one shared winner, one conflict, two durable selected events total,
  and successful unrelated selection.

## Deferred work

If Harmoniarr later supports independent per-operator candidates for the same
metadata release, introduce a normalized release-selection claim table and a
database unique constraint at that new ownership boundary. Do not retrofit a
partial index onto the current JSON payload: it would change the shared
discovery contract rather than protect it.
