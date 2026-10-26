# Local Docker backup directory synchronization outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [implementation/validation](BACKUP_DIRECTORY_SYNC_OUTCOME.md),
[design](BACKUP_DIRECTORY_SYNC_DESIGN.md) and [research](BACKUP_DIRECTORY_SYNC_RESEARCH.md).

Final image, built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:20dbf5256f846cb1485d3f8aa95318da9a81e27e88e97ace8a2441906865bcca`

Baseline:

`sha256:a54d425a1c48af6fe20d4aae29653322b84b0d39afab313ee42f55cdc0c749d0`

There are 947 packaged server modules. Three differ: the new directory-sync
service, file-operation workflow and ownership facade. All other server modules,
all 12 shared modules and all 155 client entries match baseline. All 110 runtime
npm versions/metadata, all 151 APK packages, the Node binary and six actually mapped
native binary hashes match. Root package metadata/lockfile match unchanged source.

Compose ran `up -d --wait --no-build`, followed by the disposable bootstrap, which
recognized the existing administrator. Authenticated provider/path-mapping
readiness passes. Temporary password material outside the repository was removed.
The app is healthy at `http://127.0.0.1:47956`, with loopback-only publication,
read-only root and UID 1000. Administrator/data were preserved without reset.

All five actual bind sources/access modes remain unchanged: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Startup verifies 115 applied migrations, zero newly applied and zero pending.
Runtime remains Linux amd64, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Seven affected native entries pass sequentially on this immutable image in
disposable networkless/read-only 3 GiB/two-CPU containers with tmpfs databases.
Mounted sources match independently inventoried packaged modules. The new entry
qualifies ordered directory checkpoints and retained phases/catalog through
controlled failure/cleanup, real permission failure and backend termination. The
owning outcome records the initial assertion correction and exact scope/limits.

The actual backup bind accepted directory sync before implementation and again
through the new packaged service after rebuild. The final private probe passes
final-link, temporary-cleanup and deletion directory checkpoints alongside file
readiness, exclusive link, same-inode cleanup, collision preservation and mode
`0600`. It removes its owned directory without adding live backup catalog rows.
Successful sync calls on this storage do not establish hardware power-loss safety
or persistence of newly created directory ancestors.

Unchanged parser/media/browser and unrelated SQL proof is explicitly retained,
not rerun or promoted into broader claims. Readiness sends no transfer command
and does not establish provider download/import acceptance. Configured data was
not reset to run an unconfigured-provider smoke. No release or new branch was made.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Private evidence/audit is under
`.tmp/backup-directory-sync-2026-10-26/`.
