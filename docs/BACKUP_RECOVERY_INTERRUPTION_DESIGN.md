# Backup recovery job interruption design

October 26, 2026. Follows [startup recovery](BACKUP_STARTUP_RECOVERY_OUTCOME.md).
See separate [research](BACKUP_RECOVERY_INTERRUPTION_RESEARCH.md) and
[outcome](BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md) documents.

Qualify the shipped recovery worker with real PostgreSQL leases, durable journal
rows, private files, process replacement and the existing queue/stranded-run
recovery/dispatcher/drain services. Keep controls in isolated fixture modules;
production must not acquire a test switch or another deployed service.

Use finite checkpoint names and bounded identity-bound IPC. Observe actual Linux
SIGKILL and process/stdio close, then the original backend's retirement. A live
lease must refuse takeover; crashes use the actual 30-second lease expiry before
the production stranded-run retry path. Replacement uses a new process and exact
acquisition. Never treat a sent signal as proof of retirement.

Crash checkpoints: an open verified file handle whose real fsync result is held
before delivery/close; a completed file journal update before batch progress is
saved; and a committed pause/continuation before worker lease release. The sync
fixture controls promise delivery after a real fsync, not a stalled kernel syscall.
Prove current bytes/catalog, bounded continuation, replay, confirmation holds and
live unfinished counts separately from saved batch observations.

Cooperative controls: cancellation, maintenance and replacement acquisition while
the file handle is held; dispatcher/application-owner shutdown must wait for actual
worker completion and handle close. A deliberately expired lease in the live
takeover case is controlled state injection, distinct from actual crash expiry.
Stale owners must not finish lifecycle writes or release the replacement lease.

Batch totals can omit files completed before an interrupted batch checkpoint.
Add a safe `progressMayBeIncomplete` flag derived from stranded-run recovery or an
interrupted admitted page; retain it across continuations. Current unfinished and
confirmation counts remain a fresh journal query. Present that distinction in the
existing atomic status region without focus changes. Do not imply exact historical
totals or add a per-file accounting ledger for this qualification.

| Choice | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Existing journal, fenced worker and explicit replay caveat | Small change, honest status, qualified authority | Saved totals are observations, not exact history | Implement |
| New per-run outcome ledger | Exact historical attribution could be designed | New schema/retention/transaction coordination with filesystem phases | Defer until a product requirement needs exact history |
| Mock-only interruption tests | Fast local feedback | Cannot prove process close, real lease expiry or native handle ownership | Use only for protocol/policy checks |
| Separate recovery service | Separate deployment lifetime | More authority and lifecycle surface | Reject |

Replay the native entry from PowerShell after building the current local image.
Use disposable tmpfs application/database storage; never substitute the preserved
walkthrough data bind. The guard checks Linux, the embedded database identity,
tmpfs application storage and the resource profile before seeding records.

```powershell
$recoveryImage = docker image inspect harmoniarr:walkthrough-local --format '{{.Id}}'
docker run --rm --network none --read-only --cap-drop ALL `
  --security-opt no-new-privileges:true --user 1000:1000 `
  --pids-limit 256 --cpus 2 --memory 3g --memory-swap 3g --shm-size 128m `
  --tmpfs /app/data:rw,nosuid,nodev,size=512m,uid=1000,gid=1000 `
  --tmpfs /tmp:rw,nosuid,nodev,size=256m,mode=1777 `
  --tmpfs /run/postgresql:rw,nosuid,nodev,size=32m,mode=0770,uid=1000,gid=1000 `
  --env POSTGRES_DB=harmoniarr_memory_qualification `
  --env PGDATA=/app/data/postgres/18/data --env HARMONIARR_MEMORY_PROFILE_GIB=3 `
  --mount "type=bind,source=$((Resolve-Path testing/server).Path),target=/app/testing/server,readonly" `
  --mount "type=bind,source=$((Resolve-Path test/native/backup-recovery-interruption.test.js).Path),target=/app/test/native/backup-recovery-interruption.test.js,readonly" `
  --workdir /app $recoveryImage node --test --test-concurrency=1 `
  test/native/backup-recovery-interruption.test.js
```

The entry runs for roughly two to three minutes because the three crash cases
wait for actual lease expiry and maintenance retains its pause delay. Source
fixtures/test entry are mounted read-only; production server modules come from
the immutable image. It uses no live provider, credentials or library storage.
