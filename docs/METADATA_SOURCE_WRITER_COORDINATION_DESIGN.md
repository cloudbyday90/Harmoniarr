# Metadata source writer coordination design

Selected October 12, 2026 after request publication authority. Main only, ESM
modules, no release or PR merge. Separate
[research](METADATA_SOURCE_WRITER_COORDINATION_RESEARCH_2026_10.md) and outcome
documents own source status and executed evidence.

## Boundary audit and selected protocol

Publication's existing-row locks do not fence an absent selection, override or
new snapshot. Standalone policy stores currently write without the canonical
save scope. Catalog writes and automatic/forced canonical selection likewise
lack a shared admission boundary; canonical clearing and setting are separate
autocommit statements. Bulk policy restore methods replace all scopes.

Add one transaction-level reader/writer admission key. Publication, canonical
saves, snapshot/run/recovery scope admission and per-operator policy writes hold
it shared before the existing UUID-canonicalized artist-save scope. Catalog and
bulk snapshot replacements hold it exclusively before any source reads/writes.
The lock ends on commit/rollback; do not use session locks or custom unlocks.

Order is admission → operator scope when needed → run → lease → source rows →
request identity. The save-state lock entrypoint itself takes shared admission
so existing queue/recovery callers cannot invert scope versus admission. Policy
writes in different scopes can still overlap; catalog and bulk writers serialize.
Publication holds shared admission and its scope for its complete request/event
transaction, including final source/lease checks. Changed accepted plans still
refuse; coordination does not grant new target authority.

A narrow write-transaction service owns BEGIN/COMMIT/ROLLBACK/client release when
no queryable is supplied. Borrowed callers retain transaction ownership and must
pass the same active transaction client. A transaction-only LOCK TABLE assertion
refuses an autocommit queryable before mutation; its ROW EXCLUSIVE mode does not
serialize ordinary source readers/writers. Never borrow pool.options or open a
second connection inside the caller's transaction. Use the existing runner to
preserve original Error/null and evict uncertain clients after rollback failure.

Enroll monitoring upsert, snapshot allocation, selection/override upsert and
per-artist replacements; their bulk snapshot replacements take exclusive
admission. Enroll the metadata service and exported artist/group/release upserts
so both composed and direct supported catalog writes participate. Read helpers
remain read-only. Canonical selection reads and both updates become one exclusive
admitted transaction; an update failure restores the prior canonical release.
Ranking/tie-break and manual-choice policy remain unchanged.

Capture mutable policy arrays, snapshot JSON and catalog DTOs before admission
can wait. Preserve nullable field values and the existing snapshot-container
default. Mutation by a caller must not change the values this invocation writes.
Mixed catalog/policy transactions must choose exclusive admission at entry;
upgrading a shared/scoped transaction is outside the supported caller contract.

## Alternatives and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Existing rows plus rechecks | Minimal coordination | Cannot fence absent rows through commit; reject |
| Global table SHARE locks for every publication | Automatically conflicts with raw DML | Wider table contention and scope/row order changes; defer |
| Per-artist catalog identity locks | More unrelated artist concurrency | New artist/provider identity and bulk writer ordering need more design; follow-up optimization |
| Shared admission plus scope, exclusive catalog/bulk writes | Covers audited supported writers and missing rows, retains policy concurrency | Catalog transactions serialize globally; select |

The audited contract covers first-party mutation APIs and these publication
transactions. Advisory locks do not constrain privileged raw SQL, migrations,
custom injected callbacks or external tools that bypass the protocol. Tracks,
media, availability and global Wanted projection keep their existing owners;
do not claim whole-database or full security/WCAG conformance. Backup restore
keeps its existing per-snapshot transaction boundaries and maintenance policy.
Provider HTTP and post-commit follow-ups run outside admitted SQL transactions.

## Evidence plan and recommendation stack

Reproduce an inserted selection during a held original publication on real
PostgreSQL. Controlled native tests must observe actual blocked backends using
an independent owned-config client, with readiness raced against operation
failure and all gates/drains closed before teardown. Cover missing policy rows,
new snapshots, catalog inserts/canonical replacement, bulk snapshots, writer
rollback, borrowed transaction refusal and continued read access. Keep prior
publication, save/recovery, metadata refresh and restore consumers in the
affected selection. Verify literal paths, review focused feedback, freeze source,
then run complete fast and one stable serial native group without weakened
deadlines, skips, assertions or application pool capacity.

Recommended stack: owned transaction → admission → scope/operation/acquisition →
current source/target verification → atomic request/event → final SQL-clock check
→ commit → returned discovery/worker drain. Next enroll other projection readers
where this audited boundary should provide equivalent source stability, or design
per-artist catalog partitioning with actual identity/lock-order evidence.

A subsequent source review and direct planner probe found an earlier product
gap: `operator-artist-desired-state-service.js` does not gate policy eligibility
on `isMonitored`; one future policy release remains eligible with that flag false.
This is a planner-level observation, not a full-flow reproduction. Prioritize
that automation opt-out next, preserving explicit selection consent; this writer
coordination slice intentionally retains existing selection/automation semantics.
