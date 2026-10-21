# Recovery operator lifecycle design

The October 21 native baseline produced two armed runs from concurrent arm calls.
Blocked/failed force-rearm cancelled the old run without a replacement, and a
cancellation audit failure left cancellation committed. Operator commands need
atomic state/audit publication and an owner for the absence of an armed row.

## Chosen boundary

Use a narrow ESM operator service and the existing transaction runner. Each
operator command takes the maintenance table SHARE guard, then a transaction
advisory lock in the recovery-lifecycle namespace, before touching recovery rows.
The advisory lock serializes arm/cancel even when no row exists. Completion keeps
its existing maintenance-before-row ordering and original-run ownership.

Recheck the selected run under a row lock and a fresh database-time read after
waiting. Expire stale material using database wall time. An arm denied by a
maintenance hold must not cancel valid existing material. Force replacement,
cancellation and their audit records commit together, preserving original
Error/null on rollback. Publish plaintext recovery material only after commit;
do not automatically retry an uncertain commit or command output failure.

An additive migration adds a partial unique index on `status` where status is
`armed`. It enforces at most one armed row even for writers outside the operator
service. Expiry is a state transition, not a volatile index predicate. If existing
data contains multiple armed rows, refuse migration with a bounded operator-review
error; never choose or cancel an existing code automatically. The normal migration
ledger prevents replay; a pre-existing conflicting index name also refuses DDL.
Add a schema anchor and regenerate the snapshot through the repository workflow.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Transaction alone | Atomic individual calls | Does not protect absence from concurrent arms | Insufficient |
| Unique index alone | Database-wide invariant | Raw conflicts and non-atomic replacement/audits remain | Insufficient |
| Broad recovery-table lock | Protects absence | Larger contention and lock-upgrade complexity with completion | Reject |
| Transaction advisory ownership plus partial unique index | Predictable commands, rollback, independent database guard | Consistent lock order, migration and duplicate-data refusal required | Adopt |

The stack is maintenance coordination → transaction lifecycle ownership → fresh
run row → state/audit commit → committed CLI output, with independent uniqueness
enforcement. Keep existing accessible browser status/refusal owners unchanged.

Prove native overlap/absence waits, blocked/failed replacements, cancellation
rollback and races with completion. Test direct database refusal, migration over
ambiguous data, snapshot/incremental anchors and preserved Docker upgrade. See
[research](RECOVERY_LIFECYCLE_RESEARCH_2026_10.md) and
[outcome](RECOVERY_LIFECYCLE_OUTCOME.md).
