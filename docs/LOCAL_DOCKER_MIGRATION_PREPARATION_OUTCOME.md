# Local Docker migration preparation: outcome

Date: October 26, 2026. Followed the preserved-state
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See separate
[implementation outcome](MIGRATION_PREPARATION_OUTCOME.md),
[design](MIGRATION_PREPARATION_DESIGN.md) and
[research](MIGRATION_PREPARATION_RESEARCH.md).

## Preserved deployment

Final immutable image:
`sha256:92204831fecb437961082293b8b08f7e42d4b8d1f377fee3d70e701ae7a5537c`.

A fresh Docker-container builder ran `buildx build --pull --no-cache --load` and
retired with absence verified. Compose recreated the application using
`up -d --wait --no-build`; the one-shot public bootstrap route retained the existing
administrator, and the helper retired. Readiness-only validation passed and its
temporary password file was removed. The database was not reset.

| Check | Result |
| --- | --- |
| Address | http://127.0.0.1:47956, healthy |
| Runtime | Linux amd64, UID 1000, read-only root; Node 24.22.1, npm 12.0.2 |
| Database | PostgreSQL 18.6; 115 applied, zero pending and zero newly applied migrations |
| Preserved writable binds | /app/data, /data/downloads, /data/music, /data/staging, /data/transcode-temp |
| Inventory | 966 server, 156 client, 13 shared files |
| Dependencies | 110 runtime npm and 151 OS packages, unchanged |

Before/after bind descriptors matched exactly. Runtime comparison against the
preceding committed image
`sha256:2c05e26da9af3b704951e48fb3d71f021cba9f226e1ee522dfece5b7282f47be`
matched source hashes for seven expected server changes: preparation orchestration,
migration CLI/options/policy/writer, snapshot bootstrap and SQL store. Other server
and shared files, client bytes, package metadata, dependency inventories, Node,
OpenSSL 3.5.9 and undici 7.30.1 matched preceding evidence.

Normal live startup remained on default preparation. No faulty history, fixture
role, manual retry, history repair or backup restore was applied to preserved data.
Qualification containers and their labelled volumes are temporary isolated test
resources; no additional application service was introduced.

## Actual entrypoint qualification

The final image passed seven same-volume entrypoint scenarios across 15 containers
and seven labelled local volumes. Checksum/key drift, unknown applied rows, failed
history and a missing ledger were refused before the DDL tripwire or application
startup. A valid pending upgrade applied one migration and became healthy. The
explicit retry command skipped the default preparation attempt, applied reviewed
failed SQL once, exited successfully and allowed normal healthy startup afterward.

Before/after entrypoint hashes and executable modes matched the committed baseline
and frozen source respectively. Runtime assertions verified image identity,
entrypoint/CMD ownership, UID 1000, read-only root, network none, no published ports,
3 GiB memory/swap, two CPUs, 256 PIDs and the labelled volume before operations and
removal. All containers and volumes retired with absence verified. No production
history or privilege was altered by these scenarios.

## Additional packaged checks

The final image passed the CLI fault/preparation, HTTP/backup observation and
startup/recovery entries. Their isolated tmpfs databases used the same 3 GiB/two
CPU/256 PID/network-none/read-only-root profile. All owned test containers retired
with absence verified. Six mapped native binary hashes matched preceding evidence.
The configured backup-root probe passed private directory creation, file readiness,
exclusive publication, directory sync, collision preservation, deletion and owned
probe removal. Live status/checksum/diagnose commands preserved complete ledger and
UUID function OID/xmin/definition hashes with 115 current applied rows.

The final-image full replacement matrix passed all 18 backup publication/deletion
checkpoints across 19 production-entrypoint containers. Actual SQL rollback waits
and lost acknowledgements preceded SIGKILL 137 without OOM, same-volume WAL redo,
healthy schema/HTTP startup, automatic/repeated recovery and fresh bytes/catalog
verification with background services enabled. All probes, containers and the
owned volume retired with absence verified. Migration atomicity and hardware power
loss were not established by that backup matrix.

An additional final-image standalone writer probe used an acknowledged fresh
database in its isolated cluster. It applied all 115 SQL files without snapshot
bootstrap, replayed zero with unchanged ledger hashes and passed full startup
lineage through its supplied pool. The pool drained, target sessions reached zero,
and only that acknowledged database was dropped with absence verified; the owned
container retired too.

Private source fingerprints, gate logs, build/inventory comparison, bind descriptors,
native results and retirement evidence are under
`.tmp/migration-preparation-2026-10-26/`.

No release, tag, new branch or PR merge is part of this change.
