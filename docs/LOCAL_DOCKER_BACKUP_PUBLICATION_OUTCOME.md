# Local Docker backup publication outcome

October 25, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [design](BACKUP_PUBLICATION_DESIGN.md), [research](BACKUP_PUBLICATION_RESEARCH.md)
and [implementation/validation outcome](BACKUP_PUBLICATION_OUTCOME.md).

Final image, built with a fresh disposable BuildKit builder and
`--pull --no-cache --load`:

`sha256:de950e9a43d2b20ff87af543dba8d900eb84163552fb275d219277fdf0837076`

Baseline:

`sha256:0c26a25c45f20371343b143611f4bb3afff979cca15d59b08b1740a8104e0236`

Seven server modules differ: the file service, workflow service, journal store,
artifact repository, new ownership store and scoped production service, and
system-module wiring. All other server modules, all 12 shared modules and all
155 client files match. There are 943 server modules. Package metadata, runtime
versions, 110 npm packages, 151 APK packages and six actually mapped native binary
hashes match the baseline. Schema, dependencies, lockfile and version are unchanged.

Compose ran `up -d --wait --no-build`, then the existing-administrator bootstrap
helper. Authenticated readiness passed, and temporary password material was
removed. Existing administrator/data and all five actual bind sources/access
modes are preserved: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`
and `/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root. Retained data was not reset.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime remains Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

The final publication and journal native entries pass in separate disposable,
networkless, read-only containers with tmpfs databases (3 GiB/two CPUs). Their
read-only source mounts match independently inventoried packaged modules. They
exercise actual PostgreSQL ownership, termination/recovery and files; controlled
interruptions are explicit. A separate packaged-service probe on the configured
live backup root proves hard-link support, exclusive collision behavior,
same-inode cleanup and mode `0600`; its private directory is removed. The probe
does not publish live catalog rows or establish a complete live backup/restore.

The implementation outcome records all 11,216 passing fast tests with bounded
server concurrency, focused tests and the retained unrelated evidence. No
power-loss or already-admitted-I/O fencing claim is made. Authenticated readiness
does not establish transfer/import acceptance, and no provider command was sent.

The builder, bootstrap, inventory/identity and native helpers were removed and
absence checked. Logs, inventories, mounts, readiness, bind probe and audit are
under `.tmp/backup-publication-2026-10-25/`. No branch or release was created.
