# Backup PostgreSQL crash/restart design

October 26, 2026. This extends the [SQL interruption qualification](BACKUP_SQL_CRASH_OUTCOME.md).
See [research](BACKUP_POSTGRES_CRASH_RESEARCH.md) and [outcome](BACKUP_POSTGRES_CRASH_OUTCOME.md).

Qualify the same nine journal/catalog targets in two states: a real blocked,
uncommitted statement and a committed mutation whose wire response is withheld.
Use the existing packaged backup service and fresh default recovery processes.
Only test infrastructure changes are planned unless qualification reproduces a
runtime defect.

An opt-in host runner creates a fresh, UUID-labelled Docker volume and container,
inspects their ownership/mounts before starting, and writes a read-only ownership
manifest. The container is networkless, read-only, UID 1000, two CPUs, 3 GiB with
no swap, and 256 PIDs. PostgreSQL and backup files use the owned persistent volume;
socket/temp files use tmpfs. The walkthrough's real data is never attached.
A separate persistent-profile guard validates that manifest, container identity,
database name, non-tmpfs data mount and kernel limits. The existing tmpfs-only
guard remains strict.

Before each target, force a checkpoint then commit a fixture sentinel. This creates
known committed WAL after the checkpoint. Independently observe the SQL wait or
withheld committed response, expected journal/catalog state and current bytes.
Stop the owned PostgreSQL cluster with pg_ctl immediate mode, observe completed
shutdown and retired clients, and verify that its control state still requires
crash recovery. Retire the producer/relay; do not call query cancellation or accept
a graceful database shutdown as a crash.

Restart the same data directory with fixed loopback settings and a bounded log.
Require interruption/redo/readiness evidence, stable cluster identifier, new
postmaster identity, the persisted sentinel and expected target state. Old
backend/session locks must be absent before fresh default application recovery.
Check idempotence, file contents, catalog count/identity and terminal journal rows.
Missing-tree fixture repair stays explicitly separate from default recovery.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Immediate database shutdown on an owned named volume | Real crash recovery/WAL replay on persistent storage; portable host runner | Controlled shutdown signal and Docker storage stack | Implement |
| Existing tmpfs process/SQL tests | Cheap, deterministic regression coverage | PostgreSQL stays running | Retain and rerun affected shared child coverage |
| Graceful database restart | Useful maintenance check | Clean shutdown does not prove crash replay | Separate evidence |
| Container kill/recreate | Exercises entrypoint/startup and container lifetime too | Broader process/mount lifecycle | Next qualification |
| Host/power interruption | Different persistence failure domain | Cannot be reproduced safely by process signals | No claim here |

Recommended stack: exact volume/container ownership -> guarded real SQL target ->
immediate database shutdown -> observed old process/session retirement -> same
cluster WAL recovery -> fresh default backup recovery -> repeated SQL/file
assertions -> exact cleanup. Keep controlled storage/restart evidence separate
from power-loss safety, disk failure, a deployment minimum or full HTTP-server
rollout. No additional deployed service, production fault hook, release or branch.

Replay with `node scripts/validate-backup-postgres-crash.js --image <immutable-local-image-id> --evidence-dir <fresh-directory>`.
The image argument must be a local `sha256:` image ID. The evidence directory
keeps an ownership manifest, TAP log, result and exact removal record. Never point
this lane at walkthrough storage or add a persistent-volume exception to the
existing deployment-memory profile.
