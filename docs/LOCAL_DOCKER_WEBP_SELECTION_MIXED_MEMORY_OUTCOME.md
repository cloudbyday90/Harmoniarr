# Local Docker selected WebP mixed-workload outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the
separate [design](WEBP_SELECTION_MIXED_MEMORY_DESIGN.md),
[research](WEBP_SELECTION_MIXED_MEMORY_RESEARCH.md) and
[qualification outcome](WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md).

## Rebuild and state

Used a fresh disposable BuildKit builder with `--pull --no-cache --load`:

`sha256:bfef0e4443009493c3f6eb1af2fd9e7e9aaf0e353debb5de7939878b6bf1ba76`

The preceding image was:

`sha256:6e62c6c7903d2efdb1380a99be0abb22430d55ac397d058aa9a54e1e765be45b`

All 937 server modules, 11 shared modules, 155 client files, Node binary/runtime
versions, 110 npm packages, 151 APK packages and six actually mapped native binary
hashes match. Package metadata adds one opt-in native qualification command;
dependency declarations, lockfile and application version are unchanged. Production
policy, limits, worker settings, transforms, API and UI are unchanged.

Started Compose with `up -d --wait --no-build`, ran/retired the existing-admin
bootstrap helper and passed authenticated readiness. Temporary password material
was removed. All five actual bind sources/access modes match before and after:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. Existing administrator and data were preserved.

The app remains healthy at `http://127.0.0.1:47956`, with loopback-only publication
and read-only root. Startup verified 115 applied migrations, zero pending and zero
newly applied. Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2,
PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. Builder,
bootstrap and inventory/identity helpers were removed and absence checked.

## Evidence scope

Private logs and manifests are under `.tmp/webp-selection-mixed-2026-10-25/`.
They include before/after mounts and runtime inventories, build/start/migration
logs, readiness, native binary identity, guarded profile observations and retirement.
Development preflights used the preceding native image with current source mounts;
the final matrix uses this rebuilt immutable image with read-only fixture mounts.

The new heavy fixtures create only disposable test containers, not a second
persistent service. Readiness establishes no new provider transfer/import
acceptance. The qualification outcome distinguishes fresh checks, retained
unchanged proof and the retired development fixture failure. No branch, release,
dependency upgrade or migration was created.
