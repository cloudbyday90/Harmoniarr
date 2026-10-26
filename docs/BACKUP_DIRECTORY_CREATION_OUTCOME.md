# Backup directory creation outcome

October 26, 2026. See [design/tradeoffs](BACKUP_DIRECTORY_CREATION_DESIGN.md),
[official-source research](BACKUP_DIRECTORY_CREATION_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_DIRECTORY_CREATION_OUTCOME.md).

Publication now prepares its directory tree before opening the temporary file.
A narrow ESM service confines both accepted paths to `HARMONIARR_BACKUPS` (default
`/app/data/backups`), requires its parent as an existing trusted anchor, rejects
symlink/non-directory components and caps each branch at 32 directory levels.
It creates new components explicitly with mode `0700`, then syncs the full chain
from leaf through the anchor and rechecks identities/ownership. It repeats those
checkpoints for EEXIST components; prior partial creation or restart cannot make
an uncertain ancestor disappear from the plan. Existing permissions are retained.

The byte writer no longer calls mkdir or recreates a parent after preparation.
The existing facade composes directory creation with current ownership. The
directory-sync service exposes its existing directory operation directly while
retaining the parent-directory adapter. File sync/close, exclusive publication,
temporary cleanup, namespace checkpoints and SQL phases keep their existing owners.
No new process, singleton, schema, application version or release is introduced.

Recommended stack: durable intent → bounded root/anchor plan → private nonrecursive
creation → full chain sync/close and identity checks → private byte write/sync/close
→ verified link/unlink directory checkpoints → existing SQL completion. Benefits
are explicit first-use preparation, retry-safe ancestor checkpoints and bounded
authority. Costs are extra directory I/O and requiring the configured root's
parent to be provisioned and support sync. Missing/unsupported/failed preparation
cannot advance publication or inventory. Partial directories remain for a later
attempt; speculative recursive cleanup is avoided. The design compares alternatives.

Recovery prepares the same accepted chain with mkdir disabled before reading or
adopting publication bytes. Missing components remain deferred without recreation.
Once the chain exists and checkpoints succeed, the existing workflow may abandon
an unwritten intent when both file names are absent; it cannot reconstruct bytes
from a checksum. Complete saved bytes can proceed only after current directory
and file readiness. Historical publication paths outside the current configured
root remain deferred for inspection. Anchor provisioning/durability is a deployment
responsibility; the service neither creates nor syncs above that boundary.

Baseline evidence records the preceding recursive-mkdir source hashes and the
previous actual-bind directory-sync probe. It is not a baseline power-loss test.
Focused validation passes 72 tests. New cases cover private creation order,
complete-chain retry after Error/null sync failure, partial mkdir failure,
out-of-root/depth/type refusal before I/O, missing anchor, non-directory components,
recovery without mkdir, shared-ancestor deduplication, identity replacement and
ownership loss. A byte-writer regression proves a missing parent stays missing.
Windows lifecycle fixtures control the directory-preparation boundary; native
Linux checks supply actual mkdir, sync and permission evidence.

All final bounded fast-gate stages pass: 6,074 server, 4,485 client and 700 script
tests (11,259 total), zero failures/skips/cancellations. Lint, Node/migration/schema,
ESM/image/topology/hygiene checks and build pass. The explicit server invocation
was `node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 70 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a general CI benchmark. One final frozen-source gate
follows focused checks and a passing new native preflight.

Eight final native entries pass sequentially on the rebuilt image: directory
creation, directory checkpoints, file readiness, handle cleanup, failure
precedence, journal recovery, I/O drainage and exclusive publication. Each uses a
disposable networkless/read-only 3 GiB/two-CPU container with tmpfs PostgreSQL.
The seven existing backup fixtures now explicitly configure their disposable
publication root; arbitrary temporary paths are not silently accepted as product
configuration. Their affected behavior is rerun, not retained as unchanged proof.

The new entry starts with a genuinely missing configured root under a private
existing anchor. It verifies three directory levels at `0700` and four ordered
sync/close checkpoints. Controlled Error/null failures after real directory sync
and successful close keep the journal prepared and both file names absent.
Held cleanup keeps competing local work refused. Actual backend termination
cannot admit replacement before settlement. Fresh recovery repeats the full
existing chain without mkdir, abandons unwritten intent truthfully and permits a
new publication. A real mkdir permission failure retains intent, and recovery
does not create its missing components. Saved-byte recovery checkpoints the chain
before catalog publication. Real out-of-root and symlink paths receive no byte
write. Advisory locks and all owned native helpers retire.

The injected failures follow successful real sync/close; `EBADF` confirms that
specific held handle is closed. They are not actual storage-device failures or
proof that any rejected close retires its descriptor. Backend termination is not
application-process termination, and no hardware power-loss or hostile-namespace
atomicity guarantee is claimed. Trusted private directories remain an assumption.

The live bind probe uses packaged creation, file, readiness and directory-sync
services. It creates a genuinely missing private root/leaf under an owned anchor,
repeats existing-chain checkpoints, verifies modes, then passes file readiness,
publication/cleanup/deletion sync, exclusive link and collision checks. Its owned
directory is removed without live catalog rows. Administrator, data and all five
actual mounts are preserved after the no-cache rebuild.

Exact source/runtime review retains 42 unrelated SQL checks, seven packaged router
checks, prior compressed-JSON and unchanged low-level native/provider/file-backed
mechanisms. The latest parser and guarded 64-file/3 GiB media qualifications are
retained through verified runtime transitions on identical dependency/native
versions; they are not new executions or a deployment minimum. Older metadata
memory evidence and the older 20 browser cases remain historical. No new UI/device
acceptance or memory-management service is claimed.

GitHub MCP returned zero open PRs on initial/final review, so random PR
implementation and stale-PR cleanup were not applicable. No provider PR was merged.
Dependency audit reports zero advisories at observation time. Work stays on `main`.

Frozen code/test source: 3,552 files,
`e0923e60ca9bf3208989ad42edf37b87591f10c5478bce8bda31f860f98c7e87`.
Private evidence/audit is under `.tmp/backup-directory-creation-2026-10-26/`.
Changed bytes, documentation links and resource retirement are audited.

Next recommended item: qualify actual application-process termination at the
directory, byte-write, link/unlink and SQL checkpoints. Observe process exit and
fresh default recovery in isolated storage, separating missing/unwritten intent,
verified saved bytes and catalog completion. The current tests terminate a
PostgreSQL backend and hold cooperative callbacks; they do not establish behavior
after abrupt application-process loss or hardware power loss.
