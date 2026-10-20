# Explicit recovery after an empty external search

Date: 2026-10-20. Extends [approved search recovery](EXTERNAL_SEARCH_RECOVERY_DESIGN.md).

Only a finalized, published provider search with zero response, file and locked-file
counts qualifies. Candidate filtering, publication delays, errors and cancellation
do not establish an empty search. Carry this evidence from the response adapter
through ingestion into the worker summary.
Do not backfill historical no-candidate failures as confirmed empty results.
Continuing a still-available saved search can establish the missing evidence.

Persist the last confirmed empty run/time and a fresh-search counter on the approved
intent. Record the observation inside ingestion's guarded transaction, once per
run. Keep it if a worker later loses its lease or fails: it is an observation,
not permission to queue work. The failed current run must separately qualify.

Use a six-hour cooldown after each confirmed empty search and permit two further
explicit searches after the first empty observation. These fixed project defaults
follow the existing discovery cadence/three-search envelope; they are not standards
requirements or the shared discovery settings. Count accepted fresh-search commands,
including expiry/absence recovery after an empty observation. Failed or uncertain
provider attempts still consume a command; HTTP replay does not. Persist policy on
the intent so retries, reservation expiry and operation-history retention cannot
reset it. There is no automatic reset or browser override. Exhaustion asks the
operator to review the approved release and provider health.

Reuse authenticated, CSRF-protected, rate-limited, idempotent Search again. Under
the existing user/request/intent/run locks, read database time, enforce cooldown
and budget, increment the counter, create the run, move the pointer, supersede the
old run and audit atomically. Resolve an already accepted predecessor before the
new policy check, so replay still succeeds during cooldown or after exhaustion.

Review exposes the server deadline, remaining count and fixed reason. Render the
deadline as a semantic time value and ask for Refresh after it passes; do not
automatically submit, poll or trust the browser clock. Retain uncertain-command
retry even if the latest projection is blocked. Preserve existing status/focus
ownership and current recipient checks.

Use one additive migration, a pure shared policy and a narrow persistence store.
No new queue, dependency, release or settings surface is needed. Validate genuine
empty HTTP ingestion, distinct-query recovery, cooldown, exhaustion, replay and
rollback with PostgreSQL; validate boundary policies cheaply and presentation in
the real browser shell. Report executed scope in a separate outcome document.
