# Local Docker WebP lossless rewrite outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and
[lossless design](WEBP_LOSSLESS_REWRITE_DESIGN.md). The separate
[qualification outcome](WEBP_LOSSLESS_REWRITE_OUTCOME.md) records measured tradeoffs
and the limits of any production-policy inference.

## Rebuild and preserved state

Built using a disposable BuildKit builder with `--pull --no-cache --load`:

`sha256:f8547f22b6af16239c98b02b05be96fcbfc82a3486213bfabe97a1594a283647`

Compared against the preceding normal image:

`sha256:6751387436daa469809b62a779fb40d2131dbad94d4fb4afd0695025c271bd3f`

All 934 packaged server modules, 11 shared modules and 155 client files match
exactly, including modes and hashes. Root package/lockfile bytes, the 110 npm and
151 APK inventories, Node binary and runtime versions match. New qualification
modules are test mounts; production code, dependencies and version are unchanged.

Started Compose with `up -d --wait --no-build`, ran and retired the existing-admin
bootstrap helper, and passed authenticated readiness. Temporary password material
was removed. Preserved the actual five bind sources and access modes for
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
Existing administrator/data remain present. The app is healthy at
`http://127.0.0.1:47956`, bound only to loopback with a read-only root filesystem.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. Builder and bootstrap helper were
removed. Readiness establishes no new provider search, transfer or import acceptance.

## Local evidence

Private evidence under `.tmp/webp-lossless-rewrite-2026-10-25/` includes before/
after inventories and mounts, runtime comparison, build/start/migration logs,
authenticated readiness, paired native observations, separate pixel metrics and
retired-resource records. Reused the preceding corpus's pinned prepared inputs;
there was no source download or regeneration during this comparison.

The owning outcome distinguishes fresh checks from retained production-native,
SQL/browser/provider and preparation proof. No persistent second service,
production lossless selector, fallback, new branch or release was added.
