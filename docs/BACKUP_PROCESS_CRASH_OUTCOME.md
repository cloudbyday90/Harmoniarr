# Backup process-crash qualification outcome

October 26, 2026. See [design/tradeoffs](BACKUP_PROCESS_CRASH_DESIGN.md),
[official-source research](BACKUP_PROCESS_CRASH_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_PROCESS_CRASH_OUTCOME.md).

All 19 selected application-service crash checkpoints pass. Production code,
dependencies, schema, application version and client bundles are unchanged; no
runtime defect was reproduced that required a fix. New modular ESM test helpers
own the finite plan, child work and process/IPC lifetime. The crash child imports
the actual packaged server modules, constructs the real application/owned backup
service, performs real file/store calls, acknowledges a checkpoint and waits for
SIGKILL. No production fault hook or additional deployed service was added.

Recommended stack: guarded disposable profile → real acknowledged checkpoint →
owned Node SIGKILL → observed child/stdio close → observed original backend/lock
retirement → fresh default application recovery process → current file/catalog/
journal assertions → repeated recovery → verified cleanup. This tests actual
process loss without graceful JavaScript cleanup. Its costs are fresh-process
startup and a controlled matrix rather than arbitrary syscall interruption.
Throwing an exception or killing PostgreSQL remains separate evidence. The design
compares alternatives and their pros/cons.

The twelve ordinary publication checkpoints cover intent, prepared directories,
complete bytes before sync, closed file, temporary-ready SQL, final link,
final-directory sync, temporary unlink/sync, finalized SQL, catalog insertion and
completed SQL. Six deletion checkpoints cover intent, unlink, directory sync,
finalized SQL, catalog deletion and completion. A final controlled prefix-write
case verifies that partial bytes never enter inventory.

Before each kill, an independent connection verifies the expected committed phase,
inventory count and advisory lock; actual current bytes match the case plan.
The runner signals only its actual spawned child, observes close with SIGKILL,
verifies its PID is gone, then observes the original PostgreSQL backend disappear
and its advisory lock retire. The SQL/file snapshot remains unchanged by that
termination. Each recovery child is a different process using default application
composition, with no fault factories. It repeats recovery in that same fresh
process for idempotence and exits normally with its pool/monitor drained.

Complete saved bytes recover without duplicate catalog entries. Existing catalog
identity remains stable across interrupted completion, and completed intents are
unchanged. Deletion completes from current file absence without recreating an
already-deleted catalog row. A missing directory tree initially defers without
mkdir. An explicit fixture directory repair is distinguished from the subsequent
default recovery, which abandons the still-unwritten intent. An already-prepared
but unwritten directory state is also abandoned. The controlled 32-byte prefix
remains awaiting confirmation with unchanged bytes and no inventory, including
the repeated recovery call.

The process helper bounds output to 32 KiB, validates finite IPC envelopes/counts,
excludes unrelated inherited environment/Node options and refuses to treat a kill
request as termination proof. Child identity from IPC cannot authorize signals to
another process. Startup failure, bad protocol, abnormal recovery exit or uncertain
close stays failed. Cleanup waits for owned children before removing fixture files;
the shared cleanup utility preserves the original failure through cleanup errors.
No provider credentials or raw file/catalog payloads enter IPC/results.

Focused validation passes 81 tests, including nine process-plan/protocol/lifetime
checks and the affected backup regressions. All final bounded fast-gate stages
pass: 6,083 server, 4,485 client and 700 script tests (11,268 total), zero failures/
skips/cancellations. Lint, Node/migration/schema, ESM/image/topology/hygiene checks
and build pass. The explicit server invocation was
`node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 72 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a general CI benchmark.

One final native entry passes all 19 cases on the no-cache image, using a guarded
networkless/read-only 3 GiB/two-CPU container with tmpfs database and file storage.
The checkpoint body uses real Linux process signals and packaged PostgreSQL; the
native test file takes about 38 seconds including its test-process startup. All
producer/recovery children close, original producer backends/locks retire, and the
owned fixture directory is removed. This is a controlled profile, not a memory
minimum, persistent-storage fault simulation or simultaneous worst-case workload.

The initial source-based child matrix reached the unchanged 120-second bound and
was cancelled before completion; it is not counted as passing or as a production
failure. Its log, initial source hash and verified container retirement are kept.
Switching children to packaged modules removes repeated source-mount loading and
qualifies the deployed code directly. The packaged preflight passed in about
32 seconds for the checkpoint body, followed by the final-image pass. Assertions,
19-case coverage and the 120-second bound were retained. These observations are
not a controlled source-versus-package performance benchmark. A focused lint
executor-return issue was corrected before the final frozen gate.

Exact source/runtime review retains the preceding eight backup native entries,
42 unrelated SQL checks, seven packaged router checks, previous compressed-JSON
and unchanged native/provider/file-backed mechanisms. Parser and guarded 64-file/
3 GiB media evidence remains retained through its verified runtime comparison
chain. None is a new execution or deployment minimum; older metadata-memory and
older 20 browser cases remain historical. Repeating unchanged allocation, SQL and
browser matrices was unnecessary for this test-only change.

The no-cache walkthrough is healthy with administrator, data and all five mounts
preserved. The live packaged storage probe again passes cold private-directory
creation, existing-chain checkpoints, file readiness, exclusive publication,
inode cleanup, collision preservation and deletion sync, without live catalog rows.
All builders and helper containers retire. GitHub MCP returned no open PRs on
initial/final review, so random PR implementation and stale-PR cleanup did not
apply. No provider PR was merged. Dependency audit reports zero advisories at
observation time. Work stays on `main`; no release was made.

Frozen code/test source: 3,557 files,
`fec0f7e44984a5090530307571ca2a4ce35345705638d017ee19be7208d8b35b`.
Private initial/packaged/final evidence and audit are under
`.tmp/backup-process-crash-2026-10-26/`. Changed bytes and doc links are audited.

Next recommended item: qualify termination while journal/catalog SQL is still in
flight or its acknowledgement is uncertain. Use real observed PostgreSQL waits,
original-session retirement and explicit committed/rolled-back outcomes before
fresh recovery. This matrix pauses after returned store calls; it does not qualify
lost SQL responses, PostgreSQL/container crashes, an HTTP-server rollout,
arbitrary in-flight filesystem operations or hardware power loss.
