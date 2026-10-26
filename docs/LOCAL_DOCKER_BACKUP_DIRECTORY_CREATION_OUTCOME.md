# Local Docker backup directory creation outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [implementation/validation](BACKUP_DIRECTORY_CREATION_OUTCOME.md),
[design](BACKUP_DIRECTORY_CREATION_DESIGN.md) and [research](BACKUP_DIRECTORY_CREATION_RESEARCH.md).

Final image, built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:c82619d9f28b78d32eedfc8460dcb0d0f97c7c8e9382b594650f564343b82e0a`

Baseline:

`sha256:20dbf5256f846cb1485d3f8aa95318da9a81e27e88e97ace8a2441906865bcca`

There are 948 packaged server modules. Five differ: the new directory-creation
service, directory-sync adapter, file-operation workflow, byte file service and
ownership facade. Other server modules, all 12 shared modules and all 155 client
entries match baseline. All 110 runtime npm versions/metadata, 151 APK packages,
the Node binary and six actually mapped native binary hashes match. Root package
metadata/lockfile match unchanged source.

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

Eight affected native entries pass sequentially on this immutable image in
disposable networkless/read-only 3 GiB/two-CPU containers with tmpfs databases.
Mounted sources match independently inventoried packaged modules. Existing native
backup fixtures explicitly select their disposable configured root. The new entry
qualifies missing-root creation, existing-chain retry, real mkdir permission
failure, scope/symlink refusal and ownership drainage with controlled callbacks.

The actual-bind probe uses the packaged creation service with a genuinely missing
private root/leaf under an owned existing anchor. Cold preparation, repeated
existing-chain checkpoints and `0700` directory modes pass, followed by private
file mode `0600`, readiness, exclusive publication, inode cleanup, collision and
deletion-directory checks. Its directory is removed without live catalog rows.
The default configured root's parent `/app/data` remains provisioned by deployment;
the application does not create or sync above its chosen anchor.

Unchanged parser/media/browser and unrelated SQL proof is explicitly retained,
not rerun or promoted into broader claims. Readiness sends no transfer command
and does not establish provider download/import acceptance. Existing configured
data was not reset for an unconfigured-provider smoke. No process-crash or hardware
power-loss guarantee follows. No release or new branch was made.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Private evidence/audit is under
`.tmp/backup-directory-creation-2026-10-26/`.
