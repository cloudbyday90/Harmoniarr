# Backup PostgreSQL crash/restart outcome

October 26, 2026. See [design/tradeoffs](BACKUP_POSTGRES_CRASH_DESIGN.md),
[official-source research](BACKUP_POSTGRES_CRASH_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_POSTGRES_CRASH_OUTCOME.md).

All 18 selected database crash/restart cases pass: nine real backup journal/catalog
mutation targets, each interrupted during a verified lock wait and after an
independently observed commit whose response is withheld. PostgreSQL is stopped
with immediate mode and restarted on the same owned persistent Docker volume.
No production defect was reproduced that required a runtime fix. Production code,
schema, dependencies, client bundles and application version are unchanged.

The modular ESM changes add a host qualification runner, separate persistent
ownership/profile validation, database lifecycle control, native assertions and
focused refusal tests. The earlier SQL child is now a thin entry point over a
shared worker; its default remains the unchanged strict tmpfs-only guard. The new
entry explicitly selects the persistent guard. The affected 18-case tmpfs SQL
interruption lane passes again on the final image after that refactor.

Before each target, the fixture issues a checkpoint and commits a sentinel.
Independent SQL verifies fsync, full-page writes and synchronous commit are on.
The actual store executes on its real pinned ownership session; the observer
checks either the exact lock blocker or the expected discarded wire completion,
plus current journal/catalog state and file bytes. The retained sentinel ensures
there is known committed WAL after the checkpoint.

The controller uses tools beside the running PostgreSQL executable, restricted to
the profile's declared data directory. It waits for immediate shutdown, missing
postmaster PID file and stopped pg_ctl status, and verifies the cluster control
state still indicates an interrupted running cluster. Old observer/blocker
connections end, the producer process closes and its PID disappears, and relay
sockets close before restart. There is no explicit query cancellation in this
matrix, and no claim that producer closure always occurred through SIGKILL.

Restart uses the same data directory with fixed loopback options and bounded
server logging. Every case observes interrupted-start, redo-start, redo-complete
and readiness messages, an unchanged cluster identifier and a new postmaster PID.
The sentinel persists, PostgreSQL is out of recovery, the old producer backend is
absent and no advisory locks remain. The exact pre-crash committed target snapshot
survives. A fresh default application process then performs recovery and repeats
it for idempotence; no fault factory is supplied to recovery.

Complete saved bytes recover into one catalog entry, preserving existing identity.
Deletion resumes from current absence without recreating already-deleted rows.
Completed intents remain unchanged. A rolled-back initial intent remains absent,
including preservation of an untouched deletion backup. A committed unwritten
publication intent defers on a missing directory; explicit fixture directory
repair is distinguished from default recovery, which abandons it with the expected
artifact_file_missing code. Each case verifies current bytes, catalog count and
journal completion/error state.

The host runner creates a fresh UUID-labelled local Docker volume and container,
inspects their labels/image/mounts before start, and supplies a read-only ownership
manifest. The persistent guard verifies that identity, dedicated database,
persistent filesystem, UID and kernel limits. Code/evidence binds are read-only;
the data mount must be the exact named volume. The container is networkless,
read-only, two-CPU/3 GiB with no swap and 256 PIDs. No Docker socket, live data,
operator-configured database endpoint or provider credentials are attached.
Cleanup removes only the inspected owned container and volume, verifies absence
and preserves the primary failure if cleanup fails. No broad prune is used.

The first native preflight failed because its silence assertion rejected producer
shutdown diagnostics after PostgreSQL loss. The fixture now requires silence
before the fault and in successful recovery, while reporting only bounded
post-shutdown diagnostic byte counts; raw diagnostic content is not collected.
The existing 32 KiB child-output limit remains. The failed log/source snapshot
and exact container/volume removal evidence are retained. A subsequent 18-case
persistent preflight passes; a cleanup callback was then made explicit before
the final freeze. Failed/preliminary runs are not final-source qualification.

Focused validation passes 124 backup tests, including five persistent-profile/
Docker ownership refusal checks and existing child/process/protocol regressions.
The final frozen bounded fast gate passes 6,093 server, 4,485 client and 700 script
tests (11,278 total), zero failures/skips/cancellations. Lint, Node/migration/schema,
ESM/image/topology/hygiene checks and build pass. The server invocation was
`node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 71 seconds.
This is the equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a CI performance benchmark.

Two final native entries pass on the no-cache image: 18 persistent PostgreSQL
crash/restart cases and the affected 18-case tmpfs SQL interruption regression.
The persistent profile's OOM-kill count is unchanged, all children and original
connections retire, PostgreSQL is running at native completion, and the owned
volume is removed by the host runner. These controlled profiles establish no
minimum memory requirement, simultaneous worst-case workload or performance gain.

Exact unchanged-source/runtime comparison retains the earlier 19-case process
matrix, eight prior backup native entries, 42 unrelated SQL checks, seven packaged
router checks and compressed-JSON/parser/media evidence through its verified
runtime chain. These are retained, not newly executed. Older metadata-memory and
browser histories remain historical. The actual backup-bind probe again passes
private directory creation/checkpoints, readiness, exclusive publication, inode
cleanup, collision preservation and deletion sync without live catalog rows.

The walkthrough no-cache rebuild is healthy with existing administrator, data,
provider/path readiness and all five mounts preserved. Six actually mapped native
binary hashes match baseline. GitHub MCP reports no open PRs on initial/final
review, so random PR implementation and stale-PR cleanup did not apply. No PR was
merged. Dependency audit reports zero advisories at observation time. Work remains
on main; no release, new branch or deployed application/service was created.

Recommended stack: owned volume/container -> guarded real SQL target -> immediate
database shutdown -> verified old-session retirement -> same-cluster WAL recovery
-> fresh default backup recovery -> repeated SQL/file assertions -> bounded
validation and exact cleanup. Benefits are real persisted-state coverage and no
deployed fault surface; costs are fixture complexity and controlled signal/storage
semantics. The design compares alternatives and the research records applicable
W3C status guidance. This backend qualification adds no new UI or manual
screen-reader/device acceptance evidence.

Frozen code/test source: 3,572 files,
`6edacb0c0cf44387a42f309d7007889ab2d2c5b0752af3fc8d1bc97584900997`.
Private source/preflight/final evidence and audit:
`.tmp/backup-postgres-crash-2026-10-26/`.

Next recommended item: qualify abrupt container termination and replacement using
the same isolated persistent volume. Verify the new container's actual entrypoint,
schema/startup readiness, WAL recovery and fresh backup recovery, while preserving
committed/uncommitted target distinctions. The current container stays alive during
database restarts. Neither lane qualifies host failure, arbitrary filesystem
interruption, disk corruption or hardware power loss.
