# Local Docker backup failure precedence outcome

October 26, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [design](BACKUP_FAILURE_PRECEDENCE_DESIGN.md), [research](BACKUP_FAILURE_PRECEDENCE_RESEARCH.md)
and [implementation/validation outcome](BACKUP_FAILURE_PRECEDENCE_OUTCOME.md).

Final image, built with a fresh disposable BuildKit builder and
`--pull --no-cache --load`:

`sha256:4209ff3f134aa17672ac13097c7af70a6fa3d12bfad3e633d37d5d1381ee925b`

Baseline:

`sha256:947bc4f73c6e3c88176bdcd4f2b063da43eb7af7373711847abdd2ea86622f07`

Three server modules differ: the new failure recorder, backup file-operation
workflow and production facade. Other server modules and all 12 shared modules
match; there are 945 server modules. The Vite/router PR rebuild changes 68 of 155
client file entries, and all match the local build. Runtime npm versions change
only for body-parser 2.3.0 → 2.4.0 and qs 6.16.0 → 6.16.1. Runtime package count
remains 110; all 151 APK packages and six actually mapped native binary hashes
match baseline. Package metadata/lockfile reflect these reviewed changes; the
application version and schema are unchanged.

Compose ran `up -d --wait --no-build`, then the existing-administrator bootstrap
helper. Authenticated readiness passed and temporary password material was removed.
Administrator/data and all five actual bind sources/access modes are preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and read-only root. Data was not reset.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime remains Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Five final native entries pass in separate networkless/read-only containers with
tmpfs databases (3 GiB/two CPUs). They cover failure precedence, journal recovery,
local I/O drainage, exclusive publication and actual packaged compressed JSON
parsing. Source mounts for backup entries match independently inventoried packaged
modules. The storage probe passes exclusive link/cleanup/collision behavior and
mode `0600`, then removes its directory without publishing live catalog rows.
Seven packaged Chromium router checks pass without page/asset errors.

The owning outcome records 11,227 final fast tests, 38 focused tests and exact
retention of unrelated native/SQL/provider evidence. Earlier browser proof is
historical because client bundles changed. Readiness is not transfer/import
acceptance, and no provider command was sent. No distributed fencing, power-loss,
full backup/restore or general security-conformance claim follows.

Builder, bootstrap, inventory/identity, native and browser helpers retire with
absence/normal closure checks. Final evidence/audit is under
`.tmp/backup-failure-precedence-final-2026-10-26/`; initial audit, baseline probes
and pre-parser validation remain under `.tmp/backup-failure-precedence-2026-10-26/`.
No release or new branch was created.
