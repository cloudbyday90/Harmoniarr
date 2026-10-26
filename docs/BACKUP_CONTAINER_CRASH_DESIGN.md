# Backup container replacement design

October 26, 2026. Extends the [PostgreSQL crash qualification](BACKUP_POSTGRES_CRASH_OUTCOME.md).
See [research](BACKUP_CONTAINER_CRASH_RESEARCH.md) and [outcome](BACKUP_CONTAINER_CRASH_OUTCOME.md).

Qualify the same nine backup journal/catalog mutations twice: during a real SQL
lock wait and after a committed write whose wire response is withheld. Use one
isolated labelled named volume and a succession of new containers from one pinned
local image. Keep the existing PostgreSQL/process/SQL qualification lanes unchanged.

Every container uses the production entrypoint and default server command, with
background services enabled, no published ports, no network, read-only root,
UID 1000, two CPUs, 3 GiB/no swap and 256 PIDs. Code/ownership evidence is mounted
read-only; only the exact owned volume holds database, fixture records and backups.
Reuse the strict persistent-profile guard and inspect actual image/labels/mounts.
Public fixture VAPID/encryption material supports real application startup.

The preparation process is a separate Docker exec inside the running application
container. It checks HTTP/database readiness, prepares an owned backup operation,
forces a checkpoint and commits a sentinel. Independent observation establishes
the actual SQL wait or discarded committed response, current SQL snapshot and file
bytes. A private synchronized record stores that state; a bounded host protocol
binds its hash and cluster identifier to the current container/checkpoint.

The host kills only the inspected owned container with SIGKILL, waits for exit
137 with no OOM classification, and observes its exec process close. Remove that
container while retaining and inspecting the named volume. A new container uses
the same volume/image and its own read-only ownership manifest. Require real
entrypoint migration verification, HTTP health and PostgreSQL interruption/redo/
readiness logs before a fresh verification process checks the preserved sentinel,
cluster identity and exact saved snapshot.

Fresh default backup recovery then runs twice, checking current bytes, catalog
counts/identity and terminal journal rows. Missing-tree repair remains explicit
fixture work. Compare container IDs rather than Linux PIDs across PID namespaces.
HTTP readiness alone is not backup recovery completion. Test-only PostgreSQL
logging captures startup redo; it does not change durability settings or add a
deployed fault service.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| SIGKILL and replacement on the same named volume | Exercises entrypoint, full HTTP startup, WAL replay and persisted backup state | More container startups and lifecycle evidence | Implement |
| Restart PostgreSQL inside one container | Smaller, useful database failure coverage | Does not replace the container or exercise full server startup | Retain previous evidence |
| Graceful container stop | Useful maintenance behavior | Runs cleanup and permits clean checkpoints | Separate evidence |
| Recreate with an empty volume | Useful fresh installation check | Cannot establish recovery of interrupted state | Existing separate lane |
| Host/power failure | Broader storage failure domain | Process signals cannot reproduce it faithfully | No claim |

Recommended stack: exact container/volume ownership -> real target observation ->
hash-bound synchronized fixture state -> SIGKILL/observed exit -> old-container
removal with volume retained -> production entrypoint/HTTP/WAL readiness -> fresh
default recovery/idempotence -> exact cleanup. No release, new branch, production
fault hook or additional deployed application/service is planned.

Replay uses the opt-in host script with an immutable local image ID and a fresh
evidence directory. Each stage/probe is bounded, output is capped, and cleanup
removes only acknowledged owned resources; no broad prune or live data mount.

Replay with `node scripts/validate-backup-container-crash.js --image <immutable-local-image-id> --evidence-dir <fresh-directory>`.
The image must be a local `sha256:` ID. Existing data/mounts are never supplied
to the runner. Each successful case records old/new container IDs, snapshot hash,
cluster identity and explicit startup/recovery assertions before exact removal.
