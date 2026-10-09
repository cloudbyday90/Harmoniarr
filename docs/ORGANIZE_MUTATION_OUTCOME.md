# Guarded library-organize mutation outcome

Implemented and validated on main, October 9, 2026. Separate
[design](ORGANIZE_MUTATION_DESIGN.md) and
[official research](ORGANIZE_MUTATION_RESEARCH_2026_10.md) record alternatives,
pros/cons, final stack, discovered sources and bounded guarantees. No release,
branch, tag, provider upgrade or deployment is performed.

## Implementation and ownership

Narrow ESM policy/service/store files freeze the original token and prepared
file/root/source/destination before awaiting work. Maintenance readiness uses
the caller's transaction before run/key/lease/root/file locks; database clock is
refreshed after waits. Native callbacks guard mkdir, copy/link and source cleanup.
Callback failures cannot become fallback permission, and real fallback retains
the callback. No database lock is held across filesystem I/O.

The worker delegates one guarded mutation, explicitly requests source cleanup,
and awaits plan creation. Native destination/size/source-removal proof is required
before the catalogue transaction, which repeats current ownership/cancellation
and original path/root checks and requires one changed row. Pause/cancel/lease
loss reaches the outer handler; failed/stale work does not count or notify as
moved. Existing generic defaults, root/collision/EXCL protections remain.

## Executed evidence

Focused shared-filesystem and organize policy/service checks pass 56, zero
failures/skips, on the first command; scoped lint passes. Injected stages prove
awaited callback ordering/refusal, immutable capture, raw run/source/root guards,
fresh clocks, native proof gating and catalogue CAS rollback. They do not prove
SQL lock races or actual moved bytes. Independent bounded source review finds
no material mismatch; worker/module and real execution evidence remain separate.
The adjacent command passes 21; its totals overlap these focused tests.
The final policy/filesystem command also passes 56 after readability-only
module edits. Final worker/cohort/preview checks pass 86, including two additional
owning-boundary controls for resolved plans/captured acquisitions and pause/cancel.
Fresh security validation
passes image/topology policy checks and npm audit with zero reported vulnerabilities.

The first worker/cohort command passed 82/84: two fixtures still replaced the
retired raw filesystem dependency. They now replace the guarded owner, retaining
their assertions about refused progress, zero later work and zero notification.
Preview tests use the real naming service with empty local settings, preserving
production defaults while removing accidental database/timer access.
The first real-files/PostgreSQL command passed 7/8; its lock-wait observer matched
an exact SQL comma spacing changed by readability cleanup. The observer now uses
the known lock holder's PostgreSQL PID. This preserves the real lock/expiry
assertion instead of weakening it. Original failure evidence is retained.

Final cross-writer review found a reciprocal lock order with the scan catalogue
writer. A new case pauses actual recordLibraryFiles after its root upsert, starts
the actual organize store, observes the blocking PID, then releases scan to its
file upsert. The initial joined root/file query produced PostgreSQL 40P01
deadlock detected. Organize now explicitly locks the captured root before its
file, with that file query constrained to the captured root ID. Fresh expiry
checks remain after both waits. This changes lock acquisition, not retry or
filesystem cleanup policy. The exact baseline is retained in
backend-lock-order-baseline.log. The isolated corrected case passes one and the
complete updated real-files/PostgreSQL suite passes nine, zero failures/skips,
in backend-lock-order-fixed.log and backend-postgres-nine-final.log. The ninth
case proves actual catalogue/organize coexistence and does not perform file I/O.

The first real PostgreSQL and test-owned file suite passed eight cases, zero failures/skips:
preview takeover with replacement completion, awaited native source inspection,
post-copy loss preserving both files, cancellation/maintenance, source/root
drift, collision/verification, expiry after an actual row-lock wait, and final
catalogue CAS refusal. The isolated corrected clock case passes one; focused
groups overlap the complete run. The final native move removes the source,
preserves destination bytes, updates catalogue path and emits one success event.
The post-move CAS refusal leaves moved bytes with the old catalogue path and
counts no success, demonstrating the documented partial-result limit.

The initial complete validation passed 9,389 tests (4,206 server, 4,377 client,
513 script and 293 PostgreSQL integration), zero failures/skips, all lint/policy
checks and both builds. It predates the additional cross-writer lock-order
case/fix; the complete command must pass again for the final source.
Final complete validation passes 9,390 tests (4,206 server, 4,377 client,
513 script and 294 PostgreSQL integration), zero failures/skips, all required
lint/policy checks and both builds. The nine organize cases include the real
cross-writer lock-order correction. Schema snapshot remains current at 105
migrations; no schema change is introduced. The local measured-media fixture
remains harmoniarr-quality-fallback:local,
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2,
with ffprobe 8.0.1. Full logs are full-validate-first.log and
full-validate-final.log. Focused counts overlap complete counts.
Logs and fresh raw MCP artifacts are retained under
ignored `.tmp/organize-mutation-2026-10/`. Injected callbacks are not SQL lock
proof, and DOM/status checks do not establish assistive-technology speech.

## PR applicability and practical standards skill

Fresh GitHub MCP collection/head/base/file checks found no eligible unreplayed
patch. The three open patches match their existing local replays; no random
draw, duplicate replay, downgrade or merge applies. Separate
[PR design](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_OUTCOME.md) retain actual
discovered URLs, timestamps, immutable scopes and raw hashes.

The [practical standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
references now map the native preflight/mutation/removal and guarded path owner,
explicit move cleanup, false ownership outcomes and partial-effect limits.
Source/installed structural checks pass, all four files match by SHA-256 after
sync, and entrypoint links resolve. No new blind behavioral trial, UI or
assistive-technology/conformance claim is made.

## Limits and next recommendation

Authorization checks precede filesystem effects but do not roll back I/O already
started or make filesystem/database transactions atomic. Inherited path/byte
checks and post-copy uncertainty remain explicit.

Next: fence the scan catalogue transaction with its original acquisition.
Source inspection found that the
[scan worker](../src/server/library/library-scan-worker.js) awaits its filesystem
walk, then calls recordLibraryFiles with only files/root. The
[catalogue store](../src/server/library/library-catalog-store.js) upserts the
root/files and tombstones missing paths in one transaction without a run/token
check. A delayed scan can therefore carry stale observations to that writer;
this is a source finding, not an executed scan-race reproduction.

Prefer a narrow current-owned transaction over worker-only checks or locks held
through the walk. The benefit is protecting both observed rows and missing-file
deletions; the cost is threading captured ownership through the existing writer
and respecting its lock order. Acceptance: pause old scan A after the walk,
replace it with B and persist B's files, then resume A. A must change no catalogue
rows or missing-file state; B and a genuinely current empty scan must succeed.
Post-organize partial-file reconciliation remains a separate explicit limit;
do not introduce automatic cleanup based only on an old path or file size.
