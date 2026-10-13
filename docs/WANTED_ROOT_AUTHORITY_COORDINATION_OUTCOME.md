# Wanted root-authority coordination outcome

October 13, 2026. This slice joins ordinary root-input DML to Wanted's existing
publication transaction. It does not reduce root-read frequency or file hashes.

## Implemented contract

Migration `20261013_155026_wanted_root_authority_coordination.sql` installs a
fixed security-invoker trigger function and two BEFORE STATEMENT triggers.
User insert/delete and updates targeting id, disabled state or managed private
root acquire the existing projection lock. All settings insert/update/delete
statements do the same, covering music-root missing-row insertion, replacement,
JSON null and deletion. No new lock namespace, dependency or elevated privilege.

`library-root-authority-lock-store.js` checks an active transaction with a
compatible ACCESS SHARE table lock before acquiring projection authority. Wanted's
guard store uses it on the owned client after existing run/lease ordering.
Autocommit refuses with PostgreSQL 25P01 before projection work. There is one
additional transaction-admission statement; root resolutions/hashes retain their
existing work. The explicit 24-sample root-cost/closed-group benchmarks are not
repeated; existing native root-profile controls run because their authority
fixture changes in this slice.

`schema-trigger-anchor-store.js` adds enabled trigger/function metadata to the
critical schema comparison. Missing, disabled, replication-only, changed timing/
event or changed function bodies refuse a matching named anchor. Preserve function
body whitespace because literals can carry different lock keys. The generated
108-migration snapshot includes the new function and triggers.

Earlier committed root/disabled changes are visible in a fresh Read Committed
statement after admission. Later root-input writers wait until publication
commits or rolls back. This includes work held after the real final source checks
and required source events. It queues revocation; it does not preempt an already
admitted publication. Unrelated login-only user updates still progress.

## Reviewed evidence and retained candidate failures

Nine focused unit cases pass for owned admission, original Error/null, critical
schema metadata and enabled/function-content drift, including literal whitespace.
The initial two-scenario native control passed in 24.222 seconds before later
review strengthened deletion, unavailable-source membership, counters and anchor
literal comparisons. Keep that control separate from final frozen gate evidence.

The final database-backed schema check proves 108 applied / zero pending, unknown,
checksum drift or non-applied rows; fresh snapshot bootstrap installs all 108
migrations and **135 critical anchors** match, including the two new triggers.
The native server observed is PostgreSQL 18.3. The controlled media image remains
`harmoniarr-quality-fallback:local`, digest
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with ffprobe 8.0.1. Node/dependencies remain unchanged.

The first broader candidate exposed two circular fixtures under the new contract.
A recipient-deletion test awaited its competing DELETE while holding publication
behind a gate; a root-profile callback awaited an external setting mutation while
its publisher retained the same admission lock. These consumed existing 90-second
scenario bounds; later profile tests waited for that unsettled scenario. The
candidate was rejected and its owned runner/current child stopped. Its partial
log, failed bounds and source freeze remain in the ignored evidence directory;
stopping is not proof of successful fixture drainage or a completed green gate.

The corrected deletion test observes actual database blocking, lets publication
commit, then verifies committed user deletion and cascading Wanted rows/links.
All nine other source-drift cases retain stale refusal. The root-profile test's
deliberate mutation now uses its owning transaction, preserving stale refusal
and rollback; the new dedicated tests separately prove external-writer waiting
and fresh post-commit unavailability. No skip, deadline increase, pool enlargement
or production lock weakening converts the rejected candidate to green.

## Final validation and artifact scope

The corrected serial native cohort passes **85/85 tests across sixteen literal
files** in 472.180 seconds of Node-reported test time (472.274 runner seconds),
with zero failure/cancellation/skip. It includes Wanted production closure and
profiling, current source/release reconciliation, owner deletion/link cascades,
receipt invalidation/ledger, track catalog/consent/delivery recovery, scoped
recovery, publication authority, settings and administrator recovery. This is
the affected cohort, not exhaustive integration/browser coverage.

The first fast gate then caught the migration generator's missing copyright
header. Adding four comment lines and regenerating the snapshot changes only
the migration/snapshot artifacts. Hash comparison proves all **ten JavaScript
files** are identical to the passing 85-case cohort; removing those four comment
lines reconstructs the prior migration hash exactly. Keep the broad cohort's
SQL artifact hash distinct from the final metadata correction.

For the final artifact, database-backed schema validation again proves all 108
migrations and 135 matching anchors, with zero pending/unknown/checksum drift.
The dedicated final native control passes **2/2 scenarios** in 28.198 seconds
(28.334 runner seconds), re-executing snapshot/pending migration, writer-first
revocation, nine blocked writer/rollback cases, login progress and unchanged
224-root/28-hash work. These two cases overlap the broader cohort; do not add
them as new unique coverage or repeat unchanged media/recovery experiments.

The frozen final fast gate passes **10,081 tests** (5,143 server, 4,384 client,
554 scripts), static checks and both builds in 123.217 seconds, with no test
failure/cancellation/skip. All twelve working/staged code/schema hashes match
the final freeze. Dependency audit reports zero vulnerabilities; dependencies
remain unchanged. Gate duration is not a matched whole-suite speed comparison.

Three skill structure checks and four repo/installed standards-file hashes
pass. The existing standards/testing skills gain the method; metadata and
invocation policy stay unchanged. These checks are separate from runtime proof,
a new blind trial or certification. The ignored
`.tmp/wanted-root-authority-2026-10-13/` retains rejected/stopped controls, both
artifact freezes, comparison, literal native manifest, final schema and gate logs.

## Recommendations, scope and next item

Adopt database statement admission on the existing projection lock with enabled
function-content anchors. Its benefit is ordinary writer participation and
missing-row coverage. Its cost is global settings/user-root administration
contention during publication, including root revocation waiting behind admitted
work. Keep that behavior explicit in any later batching design.

The contract covers ordinary DML with enabled triggers and consistent application
entry order. Privileged DDL/TRUNCATE/replication bypass and callers that take
conflicting tuple locks before root DML require their maintenance/transaction
contract. Database locks do not freeze host files; retain current path/descriptor
checks, opening/closing full hashes, maintenance pauses and atomic required events.
This is structural coordination, not an exhaustive security audit or a universal
latency improvement; historical intermittent PostgreSQL failures remain separate.

Recommended stack: ordinary writer admission → owned transaction → fresh
post-admission roots → bounded exact receipt capture → both full hashes → current
source/publication/event guards. Next, design bounded same-owner/requirement
opening/closing root reads within this proved publication boundary. Standalone
readers and custom adapters retain independent roots until their own contract
qualifies; compare exact outcomes and query/hash work before promotion.

See separate [design/pros and cons](WANTED_ROOT_AUTHORITY_COORDINATION_DESIGN.md),
[official research](WANTED_ROOT_AUTHORITY_COORDINATION_RESEARCH_2026_10.md),
and [PR applicability](OPEN_PR_APPLICABILITY_ROOT_AUTHORITY_2026_10_OUTCOME.md).
No new applicable PR head; no merge, branch or release.
