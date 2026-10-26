# Local Docker backup I/O drainage outcome

October 25, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [design](BACKUP_IO_DRAIN_DESIGN.md), [research](BACKUP_IO_DRAIN_RESEARCH.md)
and [implementation/validation outcome](BACKUP_IO_DRAIN_OUTCOME.md).

Final image, built with a fresh disposable BuildKit builder and
`--pull --no-cache --load`:

`sha256:947bc4f73c6e3c88176bdcd4f2b063da43eb7af7373711847abdd2ea86622f07`

Baseline:

`sha256:de950e9a43d2b20ff87af543dba8d900eb84163552fb275d219277fdf0837076`

Only three server modules differ: the new local drain coordinator, the ownership
store's shared busy error and the production facade's admission wrapper. All other
server modules, all 12 shared modules and all 155 client files match. There are
944 server modules. Package metadata, runtime versions, 110 npm packages, 151 APK
packages and six actually mapped native binary hashes match. Schema, dependencies,
lockfile and version are unchanged.

Compose ran `up -d --wait --no-build`, then the existing-administrator bootstrap
helper. Authenticated readiness passed and temporary password material was removed.
Existing administrator/data and all five actual bind sources/access modes are
preserved: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root. Retained data was not reset.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime remains Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Three final native entries pass in separate networkless, read-only containers
with tmpfs databases (3 GiB/two CPUs). Source mounts match independently inventoried
packaged modules. They cover admitted I/O drainage after real backend termination,
exclusive publication and journal regressions. The held wrapper controls admission
and later calls real link/unlink; it does not reproduce a stalled kernel syscall.
The actual backup-root probe passes exclusive link/cleanup/collision behavior and
mode `0600`, then removes its private directory. It creates no live catalog row.

The owning outcome records 11,220 passing fast tests, 31 focused tests and retained
unrelated validation. This is current-process drainage, not distributed fencing,
power-loss qualification or a full backup/restore. Authenticated readiness is not
transfer/import acceptance; no provider command was sent.

The builder, bootstrap, inventory/identity and native helpers were removed and
absence checked. Logs, mounts, inventories, readiness, baseline reproduction,
probe and audit are under `.tmp/backup-io-drain-2026-10-25/`. No branch or release
was created.
