# Backup recovery file readiness outcome

October 26, 2026. See [design/tradeoffs](BACKUP_RECOVERY_READINESS_DESIGN.md),
[official-source research](BACKUP_RECOVERY_READINESS_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_RECOVERY_READINESS_OUTCOME.md).

Recovered publication now requires fresh file readiness for complete temporary
bytes and already-final bytes. A narrow ESM service opens an existing regular file
without creation/truncation, verifies raw checksum/size and the semantic manifest
through the opened handle, awaits sync and one close, then checks current path
identity. Device/inode, size and nanosecond modification/change facts must remain
stable across the attempt. Non-regular paths are refused before open; available
no-follow/nonblocking flags also constrain open. Parent directories remain trusted.

The existing facade composes readiness with current ownership. Normal publication
keeps its writer's write/sync/close protocol; only recovery selects the new step.
Temporary-file promotion still uses an exclusive link followed by final content
verification. SQL/catalog writes retain their existing owners and phases.

Recommended stack: owned recovery → existing regular file → same-handle content
verification → awaited sync → one awaited close → current identity check →
exclusive publication/reverification/catalog. Benefits are a successful fresh file
readiness attempt and bounded cleanup ownership. Costs are extra recovery I/O,
write permission on the existing file and suppression of a secondary close error
after primary work failure. File/directory/SQL atomicity is not implied. The
design compares alternatives, including rejected rewrites and close retries.

Open/sync/close failures cannot advance the publication phase or inventory.
Existing bounded error-only recording leaves the operation deferred. Content or
identity mismatches use existing confirmation handling. Ownership loss refuses
acceptance while cleanup drains; original Error/null/undefined precedence remains.
No raw file content, path, handle or secondary error is added to diagnostics.

The baseline finding combines a static trace of the preceding recovery/verifier
with the previous native handle test's observed complete-byte adoption after
controlled writer failure. It is not new baseline fsync-call instrumentation or an
observed production storage incident. The previous artifact hash and baseline
source hashes are retained in private evidence.

Focused validation passes 53 tests. New cases cover non-truncating open, same-handle
verification, sync/close order, primary Error/null/undefined through failed close,
close-only failure, open failure, missing/non-regular files, same-size corruption,
in-flight file/path changes, disappearance after close, ownership loss and delayed
close. Workflow checks separately refuse temporary/final adoption on readiness
failure and preserve bytes, phase and empty inventory.

All final bounded fast-gate stages pass: 6,055 server, 4,485 client and 700 script
tests (11,240 total), zero failures/skips/cancellations. Lint, Node/migration/schema,
ESM/image/topology/hygiene checks and build pass. The explicit server invocation
was `node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 70 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a general CI benchmark. One final frozen-source gate
follows focused checks and the new native preflight.

Six final native entries pass sequentially on the rebuilt image: readiness,
handle cleanup, failure precedence, journal recovery, I/O drainage and exclusive
publication. They use disposable networkless/read-only 3 GiB/two-CPU containers
with isolated tmpfs PostgreSQL. The new entry uses actual handles/files and the
production facade/default composed recovery. Held close prevents competing local
admission and catalog publication. Controlled sync-null and final-close failures
preserve prepared/finalized phases and safe diagnostics. Fresh default recovery
then completes. Actual backend termination during held cleanup prevents the old
owner from adopting bytes and leaves local admission held until settlement.

Replacing a path with identical bytes during held close requires confirmation;
the old handle cannot authorize the replacement inode. Actual read-only-file
permission failure defers recovery until permissions are restored. Symlinks,
directories and partial bytes stay out of inventory. Advisory locks and native
helpers retire. Injected rejections occur after successful real sync/close, with
`EBADF` confirming that specific handle is closed; these do not establish behavior
under actual storage-device sync failure, arbitrary failed-close retirement or
power loss. The live configured backup bind also passes packaged temporary/final
readiness, exclusive link, same-inode cleanup and collision checks; its owned
directory is removed without live catalog rows.

Exact source/runtime review retains 42 unrelated SQL checks, seven prior packaged
router checks, the previous compressed-JSON entry and unchanged low-level native/
controlled-provider/file-backed mechanisms. The most recent parser qualification
and guarded 64-file media workload are retained on identical package/native
versions; they are not new executions. That media run qualified the controlled
3 GiB profile, not a minimum. Older metadata-consuming memory results and the
older 20 browser cases remain historical. No new browser/device acceptance or
memory-management service is introduced.

GitHub MCP returned zero open PRs on initial and final review, so random PR
implementation and stale-PR cleanup were not applicable. The preceding PR #55
patch remains on `main`; no provider PR was merged. Dependency audit reports zero
advisories at observation time. Dependencies, schema and application version are
unchanged; no release or new branch is created.

Frozen code/test source: 3,545 files,
`30576efee08e2b6348e0edb7c740da467d01e1ff21d09935dc589006f4127129`.
Private evidence/audit is under `.tmp/backup-recovery-readiness-2026-10-26/`.
All changed bytes and documentation links are audited before commit.

Next recommended item: define and qualify directory-sync handling after backup
link/unlink operations before reporting completed publication. The new step
establishes file readiness; it does not persist the containing directory entry.
First determine supported behavior on the actual deployment storage and how an
unsupported/failed directory sync retains journal state. Keep explicit power-loss
testing and cross-resource atomicity claims separate from successful API calls.
