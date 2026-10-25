# Local Docker artwork admission diagnostics outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See separate [design](ARTWORK_ADMISSION_DIAGNOSTICS_DESIGN.md),
[research](ARTWORK_ADMISSION_DIAGNOSTICS_RESEARCH.md) and
[implementation outcome](ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md).

Built with a fresh disposable BuildKit builder using `--pull --no-cache --load`:

`sha256:1fbcb3c6e94c2e9d972a685a08dd66d6ba5d819636e7440e36158686f590f923`

The preceding image was:

`sha256:bfef0e4443009493c3f6eb1af2fd9e7e9aaf0e353debb5de7939878b6bf1ba76`

Runtime comparison verified eight intended existing server-module edits and one
new diagnostics projector, totaling 938 server modules. The other 929 existing
server modules and 11 existing shared modules match; one shared projection module
raises that total to 12. The local client build matches all 155 packaged files;
56 differ from the prior bundle, including generated import/hash changes. Reviewed
client source changes are the Recovery diagnostics view and two small new modules.
Node/runtime versions, 110 npm packages, 151 APK packages and six mapped native
binary hashes match. Package metadata adds one opt-in native check; dependency
declarations, lockfile and application version are unchanged.

Started Compose with `up -d --wait --no-build`, ran/retired the existing-admin
bootstrap helper and passed authenticated readiness. Temporary password material
was removed. The existing administrator/data and all five actual bind sources/
access modes match: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`
and `/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root filesystem.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. Builder, bootstrap and inventory/
identity helpers were removed and absence checked.

Private build/start/migration/readiness logs, mounts, inventories, native HTTP
observations, browser evidence and retirement records live under
`.tmp/artwork-admission-diagnostics-2026-10-25/`. Development native preflights used
the preceding image with current read-only source; final HTTP qualification uses
the rebuilt immutable image. Readiness establishes no new provider transfer/import
acceptance. No new persistent service, migration, branch or release was created.
