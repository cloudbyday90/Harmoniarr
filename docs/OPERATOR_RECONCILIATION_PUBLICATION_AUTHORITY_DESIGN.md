# Operator reconciliation publication authority design

Selected October 12, 2026 after owning reconciliation completion. Main only,
modular ESM, no release or PR merge. The separate
[research](OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_RESEARCH_2026_10.md)
records official source status; an outcome will record executed evidence.

## Problem and decision

Execution reads scoped snapshot/current policy and plans requests before the
materializer opens a transaction. Publication currently receives neither captured
lease nor original policy/catalog inputs. A newer artist save, lease replacement,
expiry, cancellation or changed selection can therefore invalidate that plan
without stopping the request/event write.

Capture worker acquisition before execution awaits and clone the accepted source
immediately after the first input batch. Pass both to request materialization.
Default materialization refuses missing/invalid authority before checkout; there
is no implicit unfenced direct mode. Test dependency injection remains explicit.

For each eligible release use the existing same-client transaction runner. Set
READ COMMITTED; acquire the canonical operator artist save lock, then run row,
lease key/row, existing policy/snapshot/catalog rows, and request identity lock.
This preserves artist-save/recovery ordering and run-before-lease ordering.
The scope lock fences canonical saves even where rows are absent. No parallel
queries, provider work or discovery reconciliation runs inside that transaction.

Verify running operation/type/scoped summary, exact acquisition and database
clock expiry/cancellation. Compare latest scoped snapshot ID/revision/payload and
current semantic monitoring/selections/overrides/catalog with the captured source.
Preserve nullable values and every normalized selection/override field; exclude
read-view refresh timestamps and canonicalize selection/override ordering. Retain
catalog query order because it owns partial progress. Verify the target belongs to the
captured artist/group/release. Recheck after identity contention, before request
creation and after required event insertion, immediately before COMMIT. Existing
cancellation/maintenance hook is checked at publication checkpoints. Refusal
rolls back that release's request and required event, with bounded errors.

Forward the owned transaction queryable through the worker cancellation hook.
The existing interruption, cancellation-store and maintenance-readiness adapters
already support it. Querying the global pool from inside a guarded transaction
can starve when another client waits for the scope lock. Observe contention using
an independent fixture client built from owned connection config, never a third
checkout from the application's deliberately small pool.

Keep per-release atomicity: earlier committed releases remain durable if later
work refuses, and their discovery reconciliation still runs. Duplicate lookup
remains serialized; no new provider replay or whole-artist transaction.
Use the established transaction runner to preserve original Error/null after
rollback failure and evict an uncertain client. Discovery work starts after the
request transaction/client returns.

The shared runner now wraps non-Error rollback failures in a fixed Error for
client eviction, retaining their cause and the original operation rejection.
Passing a falsey rollback reason to pg release would incorrectly reuse a client
whose transaction state is unknown. Existing Error identity remains intact.

## Alternatives and scope

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Preflight-only check | Minimal SQL | Leaves contention/publication races; reject |
| New global serializable publication system | Potential wider invariants | New retries and large lock/transaction scope; defer |
| Captured authority with existing ordered locks and final checks | Protects canonical saves, lease ownership and request/event atomicity | Extra reads and per-release checkout; select |
| Whole-artist transaction | All requests could commit together | Longer lease locks, different partial progress policy; reject for this slice |

Current production policy writes use artist save, which owns the scope lock.
Unwired standalone update/snapshot helpers and privileged raw SQL are not granted
new writer coordination by this change. Existing-row locks plus repeated source
comparison detect/block their tested changes; absence/phantom/global catalog
writer protocols need their own audit. Do not claim a globally frozen catalog,
whole-system authorization audit, or forced cancellation of hidden work.

Snapshot policy is evidence of a saved intent; current normalized source must
still match. Do not change explicit-selection versus automation semantics during
this guard implementation. Route session/CSRF ownership is unchanged.

## Validation and next stack

Retain an original-source stale-save reproduction. Focused tests cover cloned
context/source, fail-closed admission, ordered guards, exact acquisition, latest
snapshot, nullable selection/override drift, target mismatch, expiry at final
write, duplicate serialization and Error/null cleanup. Real PostgreSQL cases
exercise canonical newer saves, contention and lock order, lease replacement/
expiry, cancellation, partial progress, event rollback, matching evidence and
source mutation. Keep both fixture lifetime cases and affected save/recovery/
wanted consumers. Verify literal selectors, freeze source, then run complete fast
and one affected serial native group without widened deadlines or added skips.

Recommended stack: captured intent/source → scope/run/lease locks → current
snapshot/policy/target verification → identity lock and duplicate check → atomic
request/event → final authority/clock check → commit → discovery and worker drain.
Next audit standalone policy/catalog writers for participation and target state
changes outside this selected protocol before broadening its guarantees.
