# Backup file-handle cleanup outcome

October 26, 2026. See [design and tradeoffs](BACKUP_HANDLE_CLOSE_DESIGN.md),
[official-source research](BACKUP_HANDLE_CLOSE_RESEARCH.md),
[Docker outcome](LOCAL_DOCKER_BACKUP_HANDLE_CLOSE_OUTCOME.md) and
[PR #55 outcome](PR_55_METADATA_OUTCOME.md).

The temporary backup writer now preserves its original write/sync rejection when
close also rejects. It reuses the existing ESM `withWorkerTaskCleanup` utility;
one production module changes. Close runs once and is awaited after work. A
close-only rejection remains visible, including null/undefined. Exclusive private
open, write/sync ordering and the existing owned publication protocol remain.

Adopt private open → awaited write/sync → one awaited close → original work
failure or close-only failure → existing journal and verified recovery. This
preserves exact failure identity and cleanup lifetime without another service.
The tradeoff is suppression of a secondary close rejection when work already
failed. Retrying close requires a stronger resource-state contract. No raw
secondary error, aggregate wrapper or handle/path detail is added to diagnostics.

The four-case controlled baseline reproduced primary Error/null masking at both
write and sync. Focused validation passes 53 tests. New unit checks cover frozen
Error/null/undefined work failures, successful/failed close, close-only failures,
open failure, ordering and a delayed close that must settle before return.

All final bounded fast-gate stages pass: 6,045 server, 4,485 client and 700 script
tests (11,230 total), zero failures/skips/cancellations. Lint, Node/migration/schema,
ESM/image/topology/hygiene checks and build pass. The explicit server invocation
was `node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 74 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a general CI benchmark. Focused checks ran first;
one final frozen-source gate avoids repeating unrelated full suites.

Seven final native entries pass on the rebuilt image: handle cleanup, metadata
parser, media scan, failure precedence, journal recovery, I/O drainage and
exclusive publication. They run sequentially in disposable networkless/read-only
containers with a 3 GiB/two-CPU profile; database-dependent entries use isolated
tmpfs PostgreSQL. No second persistent application or memory-management service
was introduced, and unrelated host work was left running.

The handle entry uses actual files, handles, PostgreSQL and the production
ownership/recovery facade. It covers complete-write, sync-null, close-only and
partial-write outcomes. Injected rejections occur after real I/O; each close
callback rejects after **successful real close**, with `EBADF` confirming that
specific handle is closed. These are controlled callback failures, not actual OS
close/fsync failures. During delayed close, competing publication and recovery
remain refused. After settlement, the original outcome and prepared journal phase
survive. Fresh recovery verifies/adopts complete bytes; partial bytes stay held
for confirmation and never enter the backup catalog.

The updated parser projects five generated formats through the real tag adapter.
A separate existing media workload persists tags for 64 files through guarded
SQL, completes three runs and releases three leases with zero active leases.
Real scan/probe/encode lifetimes overlap artwork/SQL work; transcode encodes to
null. Source hashes remain unchanged. The observed cgroup v1 peak is
1,505,890,304 bytes (about 1.40 GiB), with no OOM-kill increase and final logical
reservations zero. This qualifies that controlled workload at 3 GiB; it does not
establish a lower deployment limit or simultaneous worst-case resource use.

Exact runtime/source comparison retains 42 unchanged SQL checks, seven prior
packaged router checks, the previous compressed-JSON entry and unchanged low-level
image/media binary mechanisms. All six actually mapped native binary hashes
match. Client bundles are identical; no new browser/device acceptance is claimed.
Previous metadata-consuming memory results remain historical for the new parser,
and the older 20 browser checks remain historical. Retained proof is not a new
execution or a blanket carry-forward of all earlier native results.

The live packaged storage probe passes exclusive links, same-inode cleanup,
collision preservation and private mode `0600`, then removes its owned directory.
Administrator, data and five actual binds are preserved. Build/inventory/native
helpers retire with absence checks. Source and all changed-file bytes are audited
before commit on `main`; no schema/application-version/release change is made.

Frozen code/dependency/test source: 3,542 files,
`3d6cf0bd6ae9c0b21f921304a5680e2030491d2293440d813a3aa12e7212977b`.
Private baseline, failed fixture expectation, corrected/final runs, runtime
comparison and audit are under `.tmp/backup-handle-close-2026-10-26/`.

Next recommended item: define and qualify a fresh sync/close readiness step before
recovery adopts complete prepared bytes. Current recovery verifies content and
can publish a complete temporary file after a failed writer without a new sync.
The controlled cases demonstrate adoption, not durability after a real fsync
failure or power loss. Investigate ownership/identity checks and retained failure
state around that readiness step; do not infer durability from readable bytes or
retry an uncertain failed close. This is a protocol follow-up, not an observed
production storage incident.
