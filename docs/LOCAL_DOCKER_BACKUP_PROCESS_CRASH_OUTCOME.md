# Local Docker backup process-crash qualification outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [implementation/validation](BACKUP_PROCESS_CRASH_OUTCOME.md),
[design](BACKUP_PROCESS_CRASH_DESIGN.md) and [research](BACKUP_PROCESS_CRASH_RESEARCH.md).

Final image, built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:69ae2df531ec2fb04541b60f81160e373a057bcf97c2ab18b820afdb06aba421`

Baseline:

`sha256:c82619d9f28b78d32eedfc8460dcb0d0f97c7c8e9382b594650f564343b82e0a`

All runtime content matches baseline: 948 server modules, 12 shared modules,
155 client entries, 110 runtime npm versions/metadata, 151 APK packages, Node
binary/version metadata and six actually mapped native binary hashes. Root package
metadata/lockfile are unchanged. The new test plan/runner/child/native entry and
unit checks do not add a runtime service or production fault switches.

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

The new native entry passes 19 selected abrupt application-service checkpoints
on this immutable image. It uses one disposable networkless/read-only 3 GiB/two-CPU
container with tmpfs PostgreSQL and file storage. Producer and fresh recovery
children import actual packaged server modules. The parent checks real current
files/SQL, SIGKILL close, original backend/lock retirement and default recovery
replay. The test file takes about 38 seconds. The owning outcome records the
cancelled initial source-based attempt and limits of selected post-call boundaries.

The actual backup-bind probe again passes packaged cold private-directory
creation, repeated existing-chain checkpoints, file readiness, exclusive link,
inode cleanup, collision preservation and publication/deletion directory sync.
Its owned directory is removed without live backup catalog rows. This probe is
separate from the crash matrix's tmpfs storage and establishes no power-loss claim.

Eight prior backup native entries and unchanged SQL/parser/media/browser proof are
explicitly retained on identical runtime content, not presented as new executions.
Readiness sends no transfer command and does not establish provider download/import
acceptance. Existing configured data was not reset for an unconfigured-provider
smoke. No release, extra deployed application or new branch was made.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. Producer/recovery processes close before fixture-file removal.
Private evidence/audit is under `.tmp/backup-process-crash-2026-10-26/`.
