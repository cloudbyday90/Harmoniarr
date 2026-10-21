# Atomic admin-recovery design

The October 21 native baseline reproduced two successful completions of one run,
creating two accounts and two completion audits. A separately injected session
revocation failure left a new admin account persisted while the run remained
armed and the old session remained valid. Maintenance-lock rows alone are not a
single-use claim or a transaction boundary.

## Recommended boundary

Keep validation and password hashing outside the database transaction. Retain
the visible `admin_recovery` maintenance lock for valid-code completion, with
owned release that preserves the primary Error/null. Inside one borrowed-client
transaction, acquire the existing maintenance-table SHARE guard before row locks,
recheck restore/upgrade holds, lock the originally observed run and reread its
current state and database wall time. Never switch a pending request to a newly
armed run.

Persist the account upsert, session revocation, guarded run consumption and both
success audits on that same client. Check the consumption result; failure rolls
everything back. Its predicate checks armed state, attempt budget and current
database expiry. Use `clock_timestamp()` after waits rather than transaction-start
`NOW()` for admission. Ordinary invalid-code attempts and threshold invalidation
commit as deliberate business refusals; operational failures roll them back.

Move completion orchestration into a small service and account SQL into a narrow
store. Extend the existing recovery store with explicit queryable support rather
than copying it or introducing a singleton. Reuse the existing transaction runner
and maintenance guard. No schema migration or client contract change is needed.

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing independent writes | Simple | Reproduced partial commits and double completion | Replace |
| Claim run before independent writes | Refuses some overlap | Can consume a code without completing account/session changes | Reject |
| Transaction without fresh row ownership | Atomic individual attempts | Multiple attempts can act on stale admission | Reject |
| Borrowed-client transaction, run lock and guarded consumption | Atomic writes, one winner, fresh expiry and budget | Holds row/table guards briefly; careful lock order and refusal commits required | Adopt |
| Global Serializable/retry migration | Broad isolation | Larger blast radius, retry policy and operational cost | Defer |

The stack is existing maintenance coordination → fresh run ownership → atomic
account/session/run/audit persistence → unchanged accessible command feedback.
An uncertain commit response is not permission to automatically retry a POST.
The maintenance activity record is released separately after the transaction;
cleanup failure after a successful commit is still an uncertain caller outcome.

Qualify native overlap with a held real row, rollback after each write boundary,
existing-account restoration, expiry/cancellation during preparation, queued
invalid-attempt budgets, and maintenance acquisition ordering. Keep fresh fixture
proof separate from preserved-installation Docker readiness. See
[research](RECOVERY_ATOMIC_RESEARCH_2026_10.md) and [outcome](RECOVERY_ATOMIC_OUTCOME.md).
