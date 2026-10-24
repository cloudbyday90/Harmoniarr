# Minimal read-only review scope

Use for quality-review pages, Missing Music detail integration or cursor context.
Read active-repo docs/QUALITY_REVIEW_READ_SCOPE_DESIGN.md, research and outcome,
plus [the fact contract](qualification-candidate-facts.md).

1. Trace target resolution separately from chooser policy. Retain current owner/
   household, disabled recipient and review/conflict checks. A signed cursor does
   not grant access.
2. Reuse `readFactScope` for browsing/qualification and the explicit SQL projection.
   Full `readScope` remains on selection's current transaction/child-lock path.
   Avoid another policy calculation, cache or operation system.
3. Preserve actor/role/target, failed search, revision, participant and policy cursor
   binding. Compare full/minimal pages with one key/clock for exact cursors; include
   cursor-context parity in shared SQL/native malformed/legacy/consent/track cases.
4. Observe actual GET queries around a large failed candidate. Require minimal
   facts and no failed full-row/file/decision/raw reads or mutation locks in that
   subread. Do not report outer projection file counts as removed. Prove GET leaves
   domain work/audit/evidence unchanged.
5. Pair access/stale/disabled/malformed HTTP proof with existing scan/paging/
   selection/restart/browser cohorts. Checking, incomplete/empty pages and terminal
   focus retain their meaning. Human screen-reader/device checks are separate.

Fixture bytes are not whole-request latency, RSS or physical I/O bounds. Required
arrays and JSONB decompression remain. Retain unrelated native proof only after
exact source/test/runtime comparison; rerun changed parity on packaged PostgreSQL.
