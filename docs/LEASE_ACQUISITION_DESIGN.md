# Lease acquisition fencing design

Accepted October 9, 2026. Clean main baseline
`734ee6cdf13123e6b412e294bb499d16b86eed1d`. Work remains on main without a
branch, release, tag, provider upgrade or PR merge. Results belong in the
separate [outcome](LEASE_ACQUISITION_OUTCOME.md).

## Problem and decision

Generic lease renewal and release currently update by lease key. Fourteen
worker factories use that store through the operation-run bridge; thirteen
discard the acquired record. A delayed heartbeat or finalizer can therefore
affect a replacement lease. Unguarded run lifecycle callbacks can also overwrite
replacement status even when the lease mutation is refused.

Fresh [official research](LEASE_ACQUISITION_RESEARCH_2026_10.md) covers
PostgreSQL row locks, conditional updates, UUID/time functions and additive
migration, OWASP workflow/authorization, HTTP retries and applicable W3C feedback.
Source authority and application-specific inference remain separate.

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Compare key or instance/PID | Small change | Does not distinguish acquisitions in one instance | Reject |
| Compare millisecond acquisition timestamps | Reuses existing fields | Precision/collision ambiguity and historical frames | Reject as sole fence |
| Read the newest token in a callback | Easy adapter | Grants stale callbacks replacement authority | Reject |
| Mint a private UUID for every acquisition and capture it once | Exact ownership across all updated workers | Additive migration and complete caller propagation | Implement |

Final stack: PostgreSQL acquisition UUID; narrow ESM ownership policy and stores;
existing operation-run bridge and heartbeat; captured-token worker callbacks;
locked lifecycle/stranded recovery; existing public diagnostics with a private
token omitted. No new queue, framework or operator command.

## Contract and complete rollout

Keep job_leases.id as the stable diagnostic row identity. Add acquisition_id UUID
with a random per-row migration value/default, and replace it on every successful
acquisition. Permit only absent/released/expired takeover, including same-owner
calls; a live lease cannot be reacquired merely because the PID matches. Use
clock_timestamp for final expiry gates after waits.

normalizeExpectedJobLease captures only leaseKey, ownerInstanceId and acquisitionId.
Renew/release receive expectedLease; missing, malformed, wrong-key or stale tokens
mutate zero rows. Renewal requires an unreleased, currently unexpired matching
row. Release can retire its own expired row but cannot touch a reclaimed one.
No callback reads the current token to manufacture ownership.

All fourteen workers retain their returned acquisition locally and pass it to
heartbeat, start/complete/fail/cancel/pause and final release. Null renewal is
reported as lease loss, not successful renewal. Failed acquisition/lease loss
does not mark another worker's run failed. Stopping the timer does not make an
already pending heartbeat safe; its captured token must still fence the write.

Run lifecycle writes lock run then lease key/row, refresh time and compare current token
before mutating. Failure retry budgets are read using that transaction's client.
The existing unleased backup_restore_apply command remains an explicit narrow
exception; other leased operation types receive no key-only fallback.
Stranded recovery rechecks its observed run/claim/lease under locks and must not
rewrite parent state after an expired-release CAS loses to a new acquisition.
All cooperating acquisition, lifecycle, recovery and preparation owners use a
transaction-scoped advisory key lock before the lease row. The key lock also
fences an absent row, which FOR UPDATE alone cannot protect. Hash collisions
serialize extra work and do not grant authority; row/token checks remain required.

## Preparation compatibility and privacy

New preparation and closure frames capture acquisitionId. Previously saved
three-field lease identities remain readable evidence; their immutable frames
are never grafted with the migration's token. They cannot authorize current
dispatch without matching present ownership. Existing causal receipts, possible
dispatch and valid historical refusal/closure remain on their original paths.
Closure's direct lease acquisition must rotate the token and its release must
compare it, preserving the earlier single-transaction guarantee.

Internal lease normalization includes the token. Public lease diagnostics use an
explicit allowlist and keep stable ID/state/expiry information. Public/private
separation is not caller authorization; current server-side command guards still
apply. No new UI control or keyboard behavior is planned.

## Verification and rollout limits

Use actual PostgreSQL for migration/backfill, token changes, same-owner live
refusal, expiry after lock waits, old heartbeat/release/lifecycle callbacks,
replacement completion, stranded recovery races and rollback. Retain previous
closure, refusal, receipt and recovery regressions. Use focused injected worker
tests for token propagation and public diagnostics, then complete validation,
schema bootstrap/snapshot checks and fresh dependency audit.

The additive UUID default evaluates for existing rows and takes a migration
lock; record that cost rather than calling it a zero-lock change. Updated code
relies on cooperating producers. Stop old worker processes before deploying this
schema/code; mixed old key-only binaries cannot be made safe by a new column.
Unreleased historical leases retain their existing expiry; recovery after an
unclean stop can wait for that deadline. The migration does not force-expire work
or infer that an earlier external effect was cancelled.
No deployment or release is performed here. Tokens fence local lease/lifecycle
mutations; they cannot atomically cancel external provider or filesystem effects
already in progress. Existing final side-effect guards remain necessary.
