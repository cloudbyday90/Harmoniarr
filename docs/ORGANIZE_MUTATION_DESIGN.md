# Guarded library-organize mutation design

Accepted October 9, 2026, on clean main baseline
`5b52135f8bce389a284e6c01b8996df7cbf029dc`. No branch, release, tag, provider
upgrade or deployment. Results belong in the separate
[outcome](ORGANIZE_MUTATION_OUTCOME.md), with fresh
[official research](ORGANIZE_MUTATION_RESEARCH_2026_10.md).

## Problem and decision

Organize currently checks lease ownership during progress writes after the
filesystem action and unguarded catalogue update. A worker delayed in preview
or media preflight can therefore act after a replacement takes ownership.
The current move plan also omits source cleanup, so the native service copies
without removing the original. A zero-row catalogue update is ignored.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Check only before preview/apply | Small patch | Awaited preflight leaves later effects unguarded | Reject |
| Hold database locks throughout copy/verification | Serializes takeover | Long I/O transaction; cannot roll filesystem effects back | Reject |
| Guard each native mutation stage and catalogue CAS separately | Current token/source/maintenance decisions at the owning boundaries | Short transactions and explicit partial-effect limits | Implement |
| Replace the shared transport with rename | Appears simple | Changes overwrite/device behavior and unrelated callers | Reject |

Final stack: existing worker and explicit administrator confirmation; narrow ESM
organize policy/service/store; existing maintenance/run/key/lease/file locks;
optional trusted callbacks in the native media service; exclusive copy with
verified source cleanup; guarded catalogue update. No new queue or schema.

## Owning boundaries

Capture the original acquisition and prepared file/root/source/destination before
awaiting work. Keep the plan immutable; never load a replacement token as authority.
Require the current running organize run and no cancellation, current unexpired
token, unchanged source/root/file row, and existing maintenance write readiness.
Maintenance gating uses the transaction client and precedes run/key/lease locks.
Refresh database clock after all lock/read waits.

Final-review amendment: explicitly lock the captured library root before the
file, constrained to that root ID. The existing scan catalogue transaction
upserts its root before its files. A joined file/root lock can hold the file
while waiting for that root and create a reciprocal wait with scan. Do not rely
on join or row-mark ordering; preserve maintenance→run→lease key/row→root→file.
Prove coexistence with the actual catalogue writer paused after root upsert,
then release it while organize waits. Both transactions must finish without a
deadlock. The separate outcome records the actual reproduction and correction.

The native apply owner calls beforeMutation after source inspection and before
mkdir, again after awaited destination/device checks immediately before copy/link,
and after verification before source removal. Fallback propagates the callback;
a callback error never becomes permission to use another transport. Existing root
containment, collision refusal, COPYFILE_EXCL and size/inode checks remain in use.
Other callers may omit the hook; no global transport/default change is made.

Organize explicitly requests removeSourceAfterSuccess=true. Return moved success
only after native destination/size/source-cleanup verification and a separate
short catalogue transaction. That transaction rechecks the captured token,
cancellation, maintenance and old file/root identity and updates conditionally.
Zero affected rows is a stale refusal, not a completed move.

Worker pause/cancellation/lease-loss errors reach the owning outer handlers.
Refused work does not increment moved counts or publish Release added events.
Earlier genuinely completed files retain their normal partial-failure behavior.
No new UI control is needed; existing confirmation and job result/status remain.

## Proof and limits

Use real PostgreSQL and test-owned files to delay A after preview or native
preflight, replace its lease with B, then resume A: zero new mkdir/copy/remove,
catalogue update or notification; B can complete a real copy/remove/path update.
Cover cancellation/maintenance/source/root drift, expiry after lock waits,
guard-before-source-remove, zero-row catalogue CAS, callback/fallback behavior
and positive exclusive movement. Focused doubles verify orchestration; real
transactions/bytes own concurrency and filesystem claims. Run complete validation.

Each callback commits before filesystem I/O. Ownership can change after that
authorization instant or during an already started operation; no cross-system
atomicity, in-flight cancellation or exactly-once is promised. A post-copy refusal
retains bytes/source rather than trying unowned cleanup; partial destinations can
require review. Existing lexical path and size verification are inherited; this
slice does not establish symlink-race immunity or content-hash verification.
