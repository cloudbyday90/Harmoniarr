# Local Docker backup recovery readiness outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [implementation/validation](BACKUP_RECOVERY_READINESS_OUTCOME.md),
[design](BACKUP_RECOVERY_READINESS_DESIGN.md) and [research](BACKUP_RECOVERY_READINESS_RESEARCH.md).

Final image, built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:a54d425a1c48af6fe20d4aae29653322b84b0d39afab313ee42f55cdc0c749d0`

Baseline:

`sha256:8a81481efb3b0ce209335cf683b71ecb088f8ae70ac58e002059b63f03eeeb85`

There are 946 packaged server modules. Three differ: the new file-readiness
service, file-operation workflow and production ownership facade. All other
server modules, all 12 shared modules and all 155 client entries match baseline.
All 110 runtime npm versions/metadata, 151 APK packages, the Node binary and six
actually mapped native binary hashes match. Root package metadata/lockfile match
the unchanged reviewed source.

Compose ran `up -d --wait --no-build`, followed by the disposable bootstrap, which
recognized the existing administrator. Authenticated provider/path-mapping
readiness passes. Temporary password material outside the repository was removed.
The app is healthy at `http://127.0.0.1:47956`, with loopback-only publication,
read-only root and UID 1000. Administrator and data were preserved without reset.

All five actual bind sources/access modes remain unchanged: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Startup verifies 115 applied migrations, zero newly applied and zero pending.
Runtime remains Linux amd64, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Six affected native entries pass sequentially on this immutable image in
disposable networkless/read-only containers with 3 GiB/two CPUs and tmpfs databases.
Mounted source matches independently inventoried packaged modules. The new entry
qualifies actual handle/file/SQL ownership with explicitly controlled sync/close
rejections, real permission failure, backend termination and changed-path refusal.
The owning outcome records exact assertions and failure-injection limitations.

The configured backup-bind probe uses the packaged file and readiness services.
Real temporary and final file readiness, exclusive link, same-inode cleanup,
collision preservation and mode `0600` pass. Its private directory is removed
without adding live backup catalog rows. This qualifies the current storage's
API behavior; it is not directory durability or power-loss evidence.

Unchanged parser/media/browser and unrelated SQL proof is explicitly retained,
not rerun or promoted into broader claims. Readiness sends no transfer command
and does not establish provider download/import acceptance. Existing configured
data was not reset to run an unconfigured-provider smoke.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Private evidence/audit is under
`.tmp/backup-recovery-readiness-2026-10-26/`. No release or new branch was created.
