# Local Docker backup PostgreSQL crash/restart outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [qualification](BACKUP_POSTGRES_CRASH_OUTCOME.md),
[design](BACKUP_POSTGRES_CRASH_DESIGN.md) and [research](BACKUP_POSTGRES_CRASH_RESEARCH.md).

Final image built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:320b802e381b1cfaff8792c4c4e3e1486b87d239116ebb4a631dd4ec8014b971`

Baseline:

`sha256:a2a126b96bf755e2caee9f1ad1f6a378ca817a196c8906bf71b29d238e4e1630`

Runtime contents match baseline: 948 server modules, 12 shared modules, 155 client
entries, 110 runtime npm versions/metadata, 151 APK packages, Node binary/version
metadata and six actually mapped native binary hashes. Root package metadata/
lockfile are unchanged. Test-only source and the opt-in host runner add no deployed
proxy, application service or fault endpoint.

Compose ran `up -d --wait --no-build`, then the disposable bootstrap recognized
the existing administrator. Authenticated provider/path-mapping readiness passes;
temporary password material outside the repository was removed. The app is
healthy at `http://127.0.0.1:47956` with loopback-only publication, read-only root
and UID 1000. Existing administrator and data were preserved without reset.

All five actual bind sources/access modes remain unchanged: `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Startup verifies 115 applied migrations, zero newly applied and zero pending.
Runtime remains Linux amd64, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

The new persistent-volume native entry passes 18 PostgreSQL immediate-shutdown/
restart cases on this immutable image, with actual WAL redo and fresh default
backup recovery. Its host runner owns and removes a separate labelled Docker
volume/container, with no walkthrough storage attached. The affected tmpfs SQL
interruption entry also passes all 18 cases after the shared child-workflow
refactor. Each container is networkless/read-only, two CPUs/3 GiB, no swap and
256 PIDs. These are controlled qualification limits, not a deployment minimum.

The actual configured backup-bind probe passes private directory creation,
repeated ancestor checkpoints, readiness, exclusive links, inode cleanup,
collision preservation and publication/deletion directory sync. It removes only
its owned files and creates no live backup catalog rows. This probe is distinct
from the persistent qualification volume and from hardware power-loss evidence.

The previous process-crash matrix and unrelated backup/SQL/router/parser/media
proof are retained through exact source/runtime comparison, not presented as new
executions. Readiness sends no transfer command or download/import acceptance
claim. Existing configured data was not reset for an unconfigured-provider smoke;
managed-provider and release paths remain separate, unchanged evidence.

Builder, bootstrap, inventory/identity and native helper containers retire with
absence checks. The persistent lane additionally verifies removal of each exact
owned volume. No branch, release or provider PR merge was made. Private
source/preflight/final evidence and audit:
`.tmp/backup-postgres-crash-2026-10-26/`.
