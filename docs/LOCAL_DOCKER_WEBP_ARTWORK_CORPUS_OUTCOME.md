# Local Docker WebP artwork corpus outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and
[corpus design](WEBP_ARTWORK_CORPUS_DESIGN.md). See the separate
[measurement outcome](WEBP_ARTWORK_CORPUS_OUTCOME.md) for screening and visual-review
limitations.

## Rebuild and preserved state

Used a disposable BuildKit builder with `--pull --no-cache --load` to build:

`sha256:6751387436daa469809b62a779fb40d2131dbad94d4fb4afd0695025c271bd3f`

Compared against the preceding normal image:

`sha256:bb22248b50ffdc7603f642fed9fbca66390723c842385c055663d8d5adc73410`

All 934 packaged server modules, 11 shared modules and 155 client files match
exactly, including file modes/hashes. The 110 npm and 151 APK inventories, Node
binary and runtime versions match. Root package metadata adds only the opt-in
corpus-preparation command; dependencies and version remain unchanged. Test modules
are read-only mounts for validation, outside the app runtime.

Started Compose with `up -d --wait --no-build`, ran and retired the existing-admin
bootstrap helper, and passed authenticated readiness. Temporary password material
was removed. Compared and preserved all five actual bind sources and access modes:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The existing administrator and data remain present. The app is healthy at
`http://127.0.0.1:47956`, loopback-only with a read-only root filesystem.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. The builder and one-shot bootstrap helper
were removed. Readiness does not establish a new provider search, transfer or
import acceptance.

## Evidence and scope

Private evidence lives under `.tmp/webp-artwork-corpus-2026-10-25/`: before/after
inventories and mounts, runtime comparison, build/start/migration logs, authenticated
readiness, input preparation, native observations, pixel metrics, fixed review
artifacts and resource-retirement records. Generated images and local state remain
outside Git. The owning outcome distinguishes fresh checks from retained proof.

No persistent second app/service, production encoder switch, automatic fallback,
new branch or release was added. Keep the current production guards and use the
corpus's explicit screening result to guide the next separate policy decision.
