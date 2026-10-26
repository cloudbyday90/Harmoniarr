# Backup container replacement outcome

October 26, 2026. See [design/tradeoffs](BACKUP_CONTAINER_CRASH_DESIGN.md),
[official-source research](BACKUP_CONTAINER_CRASH_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_CONTAINER_CRASH_OUTCOME.md).

All 18 selected abrupt container replacement cases pass. Nine actual backup
journal/catalog mutation targets are tested both during a real SQL lock wait and
after an independently observed commit whose response is withheld. One owned
persistent volume is carried through 19 distinct containers and 36 Docker exec
probes. Every container uses the production entrypoint and default server command,
with background services enabled, verified schema preparation and HTTP health.
No production defect was reproduced that required a runtime change.

New modular ESM helpers separate host lifecycle, bounded probe/protocol handling,
persisted fixture records, preparation and recovery verification. The host CLI is
opt-in. Existing backup services, child helpers, strict storage guards, schema,
dependencies and client bundles are unchanged. No deployed fault endpoint, proxy,
additional application/service, new branch or release was added.

Preparation runs inside the healthy application container, using real packaged
backup/store modules. It verifies fsync, synchronous commit and full-page writes,
forces a checkpoint and commits a sentinel. The observer verifies the exact SQL
lock blocker or discarded committed wire completion, current bytes and expected
journal/catalog state. A private synchronized fixture record saves that state;
the bounded host message binds its SHA-256, cluster identifier, checkpoint and
current container identity.

The host signals only its inspected owned container with explicit KILL, waits for
exit 137, checks Docker's OOM classification is false, and observes the preparation
exec process close with exit 137. The old container is removed and its absence
verified before the named volume is inspected and reused. A genuinely new
container starts the same image/volume through the production entrypoint. No
graceful database shutdown, explicit query cancellation, manual stale-PID deletion
or WAL reset substitutes for this lifecycle.

The replacement verifies 115 applied migrations and zero pending, becomes
HTTP-healthy, and starts ordinary background services. A new verification process
checks health before recovery, the same PostgreSQL cluster identifier and
persisted sentinel, no old named producer session or advisory locks, and the exact
saved SQL snapshot. Collector logs after the saved per-case offset must show
interruption, redo start/completion and database readiness. Numeric Linux PIDs are
not compared across independent container PID namespaces.

Fresh default application recovery then runs twice without fault factories.
Complete saved bytes become one catalog entry; existing identity is preserved.
Deletion completes from current absence without recreating deleted catalog rows.
Completed intents remain unchanged. A rolled-back initial intent remains absent,
including preservation of an untouched deletion backup. A committed unwritten
publication intent defers on a missing tree. Explicit fixture directory repair is
separate from recovery, which then abandons the unwritten intent with the expected
artifact_file_missing code. Current bytes, catalog counts and terminal journal
state are verified after replay.

All containers are networkless, expose no ports, use read-only roots, UID 1000,
two CPUs, 3 GiB/no swap and 256 PIDs. The persistent guard validates the read-only
ownership manifest and exact declared database/container/volume identity. The
actual mount must be the labelled local named volume; no live application or
operator provider storage is attached. Private tmpfs media/socket/temp roots
support production startup. Public fixture VAPID/encryption values are confined
to this isolated lane. The existing tmpfs-only qualification guard stays strict.

The probe caps output at 32 KiB, validates exact finite envelopes, rejects foreign/
duplicate/missing messages and waits for observed stdio/process close. A later
valid-looking message cannot repair an earlier protocol/output failure. Invalid
container/checkpoint/record inputs refuse launch. Bounded probe diagnostics and
container logs stay in private evidence. Logging failures cannot skip owned
container/probe retirement; volume removal requires observed resource retirement,
and the original failure is preserved through cleanup failure. No broad prune is
used.

The preliminary 18-case matrix passed before final protocol/input/refusal and
cleanup review. Its initial source snapshot and evidence are retained as
preliminary, not final-source qualification. The final matrix uses the frozen
source and no-cache image; all 18 cases pass again. Static lint issues were fixed
before the final gate. Successful logs and exact removal evidence are retained.

Focused validation passes 131 backup tests, including seven new protocol,
close/output/input and production-startup inspection checks. The final frozen
bounded fast gate passes 6,100 server, 4,485 client and 700 script tests (11,285
total), zero failures/skips/cancellations. Lint, Node/migration/schema, ESM/image/
topology/hygiene checks and build pass. The server invocation was
`node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 71 seconds.
This is an equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a CI performance benchmark.

The final opt-in container qualification runs 18 cases using 19 containers and
36 exec probes on the pinned no-cache image. All containers/probes and the owned
volume retire with absence checks. These are controlled process/storage and
resource limits, not a deployment minimum, arbitrary workload or power-loss proof.
The six actually mapped native binary hashes match baseline.

Exact unchanged-source/runtime comparison retains the previous PostgreSQL crash
18-case lane, SQL interruption 18-case lane, process-crash 19-case lane, eight
earlier backup native entries, 42 unrelated SQL checks, seven packaged router
checks and compressed-JSON/parser/media proof through its verified runtime chain.
They are retained evidence, not new executions. Older metadata-memory and browser
histories remain historical. The actual backup-bind probe separately passes
private directory creation/checkpoints, readiness, exclusive publication, inode
cleanup, collision preservation and deletion sync without live catalog rows.

The no-cache walkthrough is healthy with administrator/data, provider/path
readiness and all five mounts preserved. GitHub MCP reports no open PRs on
initial/final review, so random PR implementation and stale-PR cleanup did not
apply. No provider PR was merged. Dependency audit reports zero advisories at
observation time. All changes remain on main, with no release or version change.

Recommended stack: owned container/volume -> verified real target -> hash-bound
synchronized snapshot -> KILL/observed close -> old-container removal -> replacement
entrypoint/HTTP/WAL readiness -> fresh default backup recovery/idempotence -> exact
cleanup. Pros: real startup/persistence coverage without a deployed fault surface.
Cons: additional startup cost, fixture complexity and controlled Docker storage
semantics. The design compares alternatives; the research records applicable W3C
status guidance. No new UI or manual screen-reader/device acceptance is claimed.

Frozen code/test source: 3,582 files,
`ff166778a845c0b2cfbeb3293d47ba845d1d91a9701804f1e7a98eac4a819142`.
Private source/preliminary/final evidence and audit:
`.tmp/backup-container-crash-2026-10-26/`.

This follow-up is implemented in [bounded startup backup recovery](BACKUP_STARTUP_RECOVERY_OUTCOME.md).
The snapshot behavior described below belongs to this document's baseline image;
the new replacement qualification checks automatic recovery before manual probes.

Original next recommended item: integrate bounded backup recovery into the existing
application startup/background-job flow, with administrator-visible completion,
deferral and confirmation status. This qualification establishes that HTTP-ready
startup does not itself reconcile the backup journal: the original snapshot
remains until explicit recovery is invoked. Reuse the qualified owned service and
existing operation/status infrastructure; do not block readiness indefinitely or
automatically bypass missing-tree/content confirmation. Container/host failure,
disk corruption and hardware power-loss guarantees remain separate from that
product integration.
