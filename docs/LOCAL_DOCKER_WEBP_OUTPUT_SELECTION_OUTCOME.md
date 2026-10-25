# Local Docker bounded WebP selection outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and
[selection design](WEBP_OUTPUT_SELECTION_DESIGN.md). See the separate
[implementation outcome](WEBP_OUTPUT_SELECTION_OUTCOME.md) for publication and
resource-ownership evidence.

## Rebuild and preservation

Built with a disposable BuildKit builder using `--pull --no-cache --load`:

`sha256:6e62c6c7903d2efdb1380a99be0abb22430d55ac397d058aa9a54e1e765be45b`

Compared against the preceding normal image:

`sha256:f8547f22b6af16239c98b02b05be96fcbfc82a3486213bfabe97a1594a283647`

Runtime comparison found six intended existing artwork-module changes and three
new modules (container facts, selection policy and rewrite service), totaling 937
server modules. The other 928 existing server modules, 11 shared modules and 155
client files match, including modes/hashes. Node binary, runtime versions, 110 npm
and 151 APK inventories match. Root package metadata adds one opt-in native command;
dependency declarations, lockfile and version remain unchanged.

Started Compose with `up -d --wait --no-build`, ran and retired the existing-admin
bootstrap helper, and passed authenticated readiness with temporary password
material removed afterward. Compared and preserved all five actual bind sources/
access modes: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. Existing administrator/data remain present. The app is
healthy at `http://127.0.0.1:47956`, loopback-only with a read-only root filesystem.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. Builder and bootstrap helper were
removed. Readiness establishes no new provider search, transfer or import acceptance.

## Evidence scope

Private evidence lives under `.tmp/webp-output-selection-2026-10-25/`: before/after
inventories and mounts, runtime comparison, build/start/migration logs, authenticated
readiness, native publication/cancellation/regression observations, actual mapped
binary identity and resource retirement. Pinned input artifacts were reused from
the preceding corpus; no source download or image regeneration was needed.

Development smoke containers used the preceding pinned native runtime with current
source mounts; final qualification uses this rebuilt immutable image. See the
owning outcome for fresh checks versus explicitly retained unrelated evidence.
No persistent second service, release, migration or branch was created.
