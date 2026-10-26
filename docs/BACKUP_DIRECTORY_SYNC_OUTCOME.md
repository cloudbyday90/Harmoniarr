# Backup directory synchronization outcome

October 26, 2026. See [design/tradeoffs](BACKUP_DIRECTORY_SYNC_DESIGN.md),
[official-source research](BACKUP_DIRECTORY_SYNC_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_DIRECTORY_SYNC_OUTCOME.md).

Backup publication now syncs/closes the final parent after current final-byte
verification, before retiring the matching temporary name. It then syncs/closes
the temporary parent before finalized/catalog/completed writes. Recovery repeats
these checkpoints for an already-final file and an already-missing temporary name.
Distinct recorded parents are supported. Deletion syncs/closes the parent after
unlink or verified current absence, before advancing phase or deleting inventory.

A small ESM directory-sync service owns read-only existing-directory open, typed
directory and device/inode checks, current ownership, sync, one awaited close and
post-close identity acceptance. The existing production facade supplies ownership;
the workflow owns ordering and the existing stores own SQL. Shared publication
finalization removes duplicate orchestration. No new process, singleton, schema,
application version or release is introduced.

Recommended stack: verified final bytes → final-parent sync/close → inode-owned
temporary cleanup → temporary-parent sync/close → existing durable SQL completion.
Deletion uses verified unlink/absence → parent sync/close → SQL completion. The
benefit is explicit ordered namespace checkpoints. Costs are extra recovery/
mutation I/O and a requirement that storage support directory sync. Unsupported,
missing, denied or failed sync leaves the prior phase and inventory available for
recovery; no silent fallback reports completion. No automatic directory recreation
or uncertain close retry occurs. The design records alternatives and pros/cons.

The baseline combines a static trace of link/unlink-to-journal ordering with a
real configured-directory capability probe. Its source hashes and image identity
are retained. It is not a baseline power-loss experiment. The existing directory
on the actual backup bind accepted read-only open, sync and close.

Focused validation passes 64 tests. New unit checks cover read-only flags,
directory identity changes, original Error/null/undefined through failed cleanup,
close-only failure, missing/non-directory parents, unsupported sync, ownership
loss and delayed close. Workflow checks verify ordering, both publication failure
points, repeated checkpoints for already-final/missing-temporary state and deletion
retry after the file is absent. Windows unit lifecycle fixtures explicitly control
the directory-sync boundary; they do not establish native Windows support.

All final bounded fast-gate stages pass: 6,066 server, 4,485 client and 700 script
tests (11,251 total), zero failures/skips/cancellations. Lint, Node/migration/schema,
ESM/image/topology/hygiene checks and build pass. The explicit server invocation
was `node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 71 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a general CI benchmark. One final frozen-source gate
follows focused validation and the corrected native preflight.

Seven final native entries pass sequentially on the rebuilt image: directory
checkpoints, file readiness, handle cleanup, failure precedence, journal recovery,
I/O drainage and exclusive publication. They use disposable networkless/read-only
3 GiB/two-CPU containers with isolated tmpfs PostgreSQL. The new entry exercises
eight scenarios through the production facade: final-link checkpoint, temporary
cleanup checkpoint, deletion after unlink/absence, already-final recovery,
close-only failure, unsupported sync and ownership loss. Held cleanup prevents
competing local admission and premature catalog/phase writes. Fresh default
recovery completes each retained operation. Actual backend termination during
held cleanup cannot release local admission early. An actual directory-open
permission failure retains intent, and a distinct-parent recovery syncs both
recorded directories in order. Advisory locks and helper containers retire.

Most injected failures follow successful real directory sync/close; `EBADF`
confirms that specific directory handle is closed. The unsupported-sync callback
rejects before real sync. These are controlled failure callbacks, not storage-device
failures or proof that an arbitrary rejected close retires its descriptor. Real
permission failure is separately identified. No power-loss guarantee is claimed.

The initial native preflight failed because its test expected `ENOTSUP` in the
journal. The existing finite projection correctly stores
`backup_artifact_file_operation_failed`, while the caller retains the exact
original `ENOTSUP` error. Only that precise expectation changed; arbitrary errors
are not allowed and runtime policy was not weakened. The failed log, original
candidate hash and verified container retirement remain beside the corrected
preflight and final-image pass.

The live configured-bind probe uses packaged file, readiness and directory-sync
services. Publication/cleanup/deletion directory checkpoints, exclusive link,
same-inode cleanup, collision preservation and mode `0600` pass. Its private
directory is removed without live backup catalog rows. Administrator, data and all
five actual mounts remain intact after the no-cache walkthrough rebuild.

Exact source/runtime comparison retains 42 unrelated SQL checks, seven packaged
router checks, the prior compressed-JSON entry and unchanged low-level native/
controlled-provider/file-backed mechanisms. The latest parser and guarded
64-file/3 GiB media qualifications are retained through the recorded comparison
chain on identical dependency/native versions; they are not new executions or a
deployment minimum. Older metadata-consuming memory results and the older 20
browser cases remain historical. No new UI/device acceptance is claimed.

GitHub MCP returned no open PRs on initial/final review, so random PR implementation
and stale-PR cleanup were not applicable. No provider PR was merged. Dependency
audit reports zero advisories at observation time. Work stays on `main`.

Frozen code/test source: 3,549 files,
`79d67eee79072f879f34e9755b7a412408b9d33bc2833fca36477f754bda719a`.
Private evidence/audit is under `.tmp/backup-directory-sync-2026-10-26/`.
Changed bytes, documentation links and owned-resource retirement are audited.

Completed by the [directory creation outcome](BACKUP_DIRECTORY_CREATION_OUTCOME.md).
The recommended item was to qualify durable first-use backup-directory creation. The
writer still uses recursive mkdir; syncing entries inside the resulting directory
does not persist newly created ancestor links. Define bounded traversal within
the configured private root, sync affected ancestor entries, and preserve intent
on failure. Keep process-crash tests, hardware power-loss behavior and SQL/file
atomicity as separate claims.
