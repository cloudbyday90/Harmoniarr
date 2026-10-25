# Local Docker WebP effort comparison outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and
[comparison design](WEBP_EFFORT_COMPARISON_DESIGN.md). The separate
[comparison outcome](WEBP_EFFORT_COMPARISON_OUTCOME.md) records measurements,
invalid attempts and the production-policy decision.

## Rebuild and preserved state

Built with a disposable BuildKit builder using `--pull --no-cache --load`:

`sha256:bb22248b50ffdc7603f642fed9fbca66390723c842385c055663d8d5adc73410`

Compared with the preceding image:

`sha256:1a250054ba0aba04083cd14bfd1a30cb0089b29fe5489e2f672c83e89928eaec`

All 934 packaged server modules, 11 shared modules and 155 client files match
exactly, including modes and hashes. The 110 npm and 151 APK package inventories,
Node binary and runtime versions match. Only root package metadata adds the
opt-in comparison command; dependency and version declarations remain unchanged.
The new ESM comparison modules and native entry are test mounts, outside the app
runtime. No persistent service or production effort/fallback change was added.

Started with Compose `up -d --wait --no-build`, ran and retired the existing-admin
bootstrap helper, and passed authenticated readiness using a temporary password
file that was removed. Preserved the actual five bind sources and access modes
for `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. Existing administrator/data remain present.

The app is healthy at `http://127.0.0.1:47956`; its port is loopback-only and root
filesystem read-only. Startup verified 115 applied migrations, zero pending and
zero newly applied. Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2,
PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. The disposable builder
and one-shot bootstrap helper were removed. Readiness establishes no new provider
search, transfer or import acceptance.

## Local evidence

Private evidence lives under `.tmp/webp-effort-comparison-2026-10-25/`: inventories,
runtime comparison, build/start/migration logs, before/after mount manifests,
authenticated readiness and retired-resource evidence. Measurements use the
immutable rebuilt image, not the prior diagnostic-tools image.

The comparison's native guard now also verifies the existing 256 MiB temporary
filesystem profile. That test-only correction changes no packaged runtime file;
the final source fingerprint and artifact audit establish its validated state.
See the owning outcome for fresh comparison/control results and precisely
retained earlier checks. No release or new branch is created.
