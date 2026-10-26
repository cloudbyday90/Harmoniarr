# Local Docker backup container replacement outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [qualification](BACKUP_CONTAINER_CRASH_OUTCOME.md),
[design](BACKUP_CONTAINER_CRASH_DESIGN.md) and [research](BACKUP_CONTAINER_CRASH_RESEARCH.md).

Final image built with a fresh disposable BuildKit builder using
`--pull --no-cache --load`:

`sha256:4294bec1adc5eb4c29481eca267c7700db63316fb062ffb97a512f1d1de3a0d1`

Baseline:

`sha256:320b802e381b1cfaff8792c4c4e3e1486b87d239116ebb4a631dd4ec8014b971`

Runtime contents match baseline: 948 server modules, 12 shared modules, 155 client
entries, 110 runtime npm versions/metadata, 151 APK packages, Node binary/version
metadata and six actually mapped native binary hashes. Root package metadata/
lockfile are unchanged. New ESM qualification modules and the opt-in host runner
are not deployed application services or fault endpoints.

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

The opt-in final-image container qualification passes 18 abrupt replacement cases
using 19 distinct containers and 36 exec probes on one owned persistent volume.
Each container runs the actual entrypoint and default HTTP server, including normal
background services, in a networkless/read-only two-CPU/3 GiB/no-swap profile.
The runner verifies exit 137 without Docker's OOM classification, removes the old
container while retaining its exact named volume, then verifies production
startup/schema/HTTP readiness, WAL replay, preserved state and fresh backup
recovery in the new container. All containers, probes and the volume are removed.
This lane attaches no walkthrough storage and is not a deployment minimum.

The actual configured backup-bind probe passes private directory creation,
repeated ancestor checkpoints, readiness, exclusive links, inode cleanup,
collision preservation and publication/deletion directory sync. It removes only
its owned files and creates no live backup catalog rows. This probe is distinct
from the qualification volume and from hardware power-loss evidence.

Earlier database/process/SQL crash matrices and unrelated backup/router/parser/
media proof are retained through exact source/runtime comparison, not described
as new executions. Readiness sends no transfer command or download/import
acceptance claim. Existing configured data was not reset for an unconfigured-
provider smoke; managed-provider and release paths remain separate evidence.

Builder, bootstrap, inventory/identity and qualification helper resources retire
with absence checks. No new branch, release or provider PR merge was made.
Private source/preliminary/final evidence and audit:
`.tmp/backup-container-crash-2026-10-26/`.
