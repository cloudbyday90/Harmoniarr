# Wanted source no-op design

Date: 2026-10-13. Baseline: `b4c061d`.

The [distinct-binding profile](WANTED_DISTINCT_BINDING_PROFILE_OUTCOME.md)
identified a full projection before every conditional source update, including
updates that cannot write. For its satisfied-source fixture, B bindings cause
B+5 projections and 2B(B+5) full hashes. This slice removes only proven no-op
source checks; it does not cache availability or change file verification.

For a nonempty satisfied-source workload where every selected source qualifies,
the remaining work is five complete projections and 10B full hashes. Missing
requirements, real transitions, busy rows and unsupported source shapes retain
additional checks; this formula is not a general upper bound.

## Contract

Canonical Wanted passes its private, invocation-scoped root authority to the
default source lifecycle service. The authority identifies the exact queryable
and transaction. A separate ESM store attempts a row lock only for an available
source with exact request, owner, release and saved JSON scope whose current
request state is `already_exists`. This is a strict subset of no-ops: the existing
UPDATE requires `needs_fetch` when availability is true, so this locked row
cannot satisfy that predicate. No UPDATE or required source event is dispatched.

The lock is `FOR NO KEY UPDATE NOWAIT` inside a savepoint. Successful savepoint
release keeps the row lock until transaction end. SQL checks the current
transaction ID against the private authority. A busy row (`55P03`) rolls back
and releases the savepoint before the original guarded path runs. Other errors
propagate unchanged. Missing/mismatched rows, negative sources, unsupported
authority, custom stores and compatibility mode keep their original path.
There is no absent-row proof and no cross-invocation plan/cache.

Preserve captured-source deduplication (a current available copy wins), serial
request ordering, maintenance admission, current run/lease/cancellation checks,
the guard before each actual transition, atomic required events, and the final
complete projection/authority comparison. Every retained positive receipt group
still receives opening and closing full hashes with current roots. Fulfillment
does not receive this authority and stays conservative.

## Tradeoffs and verification

Row locks can delay later source writers. NOWAIT prevents this optimization from
adding a wait for an earlier row holder; it does not remove existing fallback
waits, table-lock waits or all possible database deadlocks. Ordinary SQL writers
need no new trigger. Privileged DDL/trigger changes remain outside the application
contract. Source locking cannot freeze host files.

Use native PostgreSQL proof for exact current predicates, busy-row fallback,
transaction expiry/reuse, commit/rollback lock release, real production default
wiring, late file/authority refusal and required-event rollback. Compare complete
private Wanted results, projection digests and durable request/event deltas on
fresh rollback-owned samples; reduced hash work must use its own comparator,
not the unchanged-work root comparator. Keep scaling explicit, separate setup
and rollback from timing, and preserve failed candidate evidence.

See [research](WANTED_SOURCE_NOOP_RESEARCH_2026_10.md) and
[outcome](WANTED_SOURCE_NOOP_OUTCOME.md).
