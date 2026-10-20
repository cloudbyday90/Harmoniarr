# Approved external-request search recovery design

Date: 2026-10-20. Follows [shared-search recovery](SEARCH_RECOVERY_OUTCOME.md).

An approved external release owns a discovery intent and its current operation
run. Expired/absent saved provider searches need a deliberate new run; repeated
approval and ordinary job retry must retain their existing meanings.

Persist only allowlisted continuation failure codes in the discovery worker's
job summary, with fixed public messages. Review projects Search again only for
the current eligible recipient and a failed current run with a known expiry or
absence code. Download/import success and arbitrary failures do not qualify.

Use a narrow ESM recovery service and persistence store. A command names the
approved intent and expected failed operation run; it never accepts a recipient
or replacement release from the browser. Require fresh administrator session,
CSRF, rate limiting and the existing durable idempotency service. Keep the key
after uncertain responses; the expected old run also coalesces distinct keys.

At the transaction boundary: maintenance guard; eligibility lock for the
preflight recipient; request row lock; reread request and refuse changed target;
current target eligibility; intent and current operation row locks. Refuse
inactive requests, cross-request intents, unapproved/replaced targets, active work
or unknown terminal failures. Serialize against ordinary job retry through the
operation row lock. A direct replacement run records its predecessor so replay
can return that same queued result without minting another run.

Create the replacement run, update the intent pointer, mark the previous run
superseded and record required audit in one transaction. A database predicate on
ordinary retry refuses superseded external search runs, including a retry that
read old eligibility before blocking behind recovery. The previous run must be
updated, not merely read-locked, so PostgreSQL rechecks a waiting UPDATE against
the changed row. Current unsuperseded job retry still reads its saved provider ID.
The new run ID changes the already-supported durable search context; preserve
all previous provider reservations.

Use the existing external review surface, a focused recovery component and
composable, native buttons, fixed accessible names, persistent polite status and
bounded errors outside busy state. Refresh current review after acceptance;
preserve the queued result if optional refresh fails. Restore meaningful focus
only while the command still owns it. A historical Background Jobs link opens
the owning request review and grants no mutation authority.

No schema, dependency, version, branch or release change is required. Prove
transaction rollback, concurrency/replay, stale job retry, disabled/replaced
targets and distinct provider UUIDs in PostgreSQL/HTTP; prove keyboard, pending,
uncertainty and focus behavior in the browser. Separate executed results in the
[outcome](EXTERNAL_SEARCH_RECOVERY_OUTCOME.md).
