# Local Docker backup handle cleanup outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [implementation/validation](BACKUP_HANDLE_CLOSE_OUTCOME.md),
[design](BACKUP_HANDLE_CLOSE_DESIGN.md) and [research](BACKUP_HANDLE_CLOSE_RESEARCH.md).

Final image, built using a fresh disposable BuildKit builder with
`--pull --no-cache --load`:

`sha256:8a81481efb3b0ce209335cf683b71ecb088f8ae70ac58e002059b63f03eeeb85`

Baseline:

`sha256:4209ff3f134aa17672ac13097c7af70a6fa3d12bfad3e633d37d5d1381ee925b`

The only changed packaged server module is
`recovery/backup-artifact-file-service.js`; there are 945 server modules. Other
server modules, all 12 shared modules and all 155 client entries match baseline.
Runtime package changes are music-metadata 12.2.1 → 12.2.3 and strtok3 10.5.0 →
10.6.2. All other runtime npm versions, all 151 APK packages, the Node binary and
six actually mapped native binary hashes match; runtime npm count remains 110.
Package metadata and lockfile match the reviewed source.

Compose ran `up -d --wait --no-build`, followed by the disposable bootstrap, which
recognized the existing administrator. Authenticated provider/path-mapping
readiness passes. Temporary password material outside the repository was removed.
The app is healthy at `http://127.0.0.1:47956`, with loopback-only publication,
read-only root and UID 1000. Administrator and data were preserved without reset.

All five actual bind sources and access modes are unchanged: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Startup verifies 115 applied migrations, zero newly applied and zero pending.
Runtime remains Linux amd64, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Seven targeted native entries pass on this immutable image in sequential,
disposable networkless/read-only containers. Read-only mounted sources match the
independently inventoried packaged modules; the final parser check uses the image's
packaged dependencies. The guarded 64-file media scan passes with tags persisted,
leases drained and unchanged source hashes. The 3 GiB workload's observed peak is
1,505,890,304 bytes with no OOM-kill increase. This is one controlled profile,
not a deployment minimum. The owning outcome records failure-injection and
memory-measurement limits and distinguishes retained from newly executed proof.

The live configured backup-bind probe uses the packaged file service and confirms
exclusive link, same-inode cleanup, collision preservation and mode `0600`.
Its private directory is removed without creating live backup catalog rows.
Readiness sends no provider transfer command and does not claim import acceptance.
No fresh unconfigured-provider smoke or full backup/restore claim is made.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Evidence/audit is under `.tmp/backup-handle-close-2026-10-26/`.
No new branch or release was created.
