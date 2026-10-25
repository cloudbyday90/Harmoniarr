# Local Docker Recovery diagnostic events outcome

October 25, 2026. Follows the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See separate [design](RECOVERY_DIAGNOSTIC_EVENTS_DESIGN.md),
[research](RECOVERY_DIAGNOSTIC_EVENTS_RESEARCH.md) and
[implementation outcome](RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md).

Built with a fresh disposable BuildKit builder using `--pull --no-cache --load`:

`sha256:4e8633cee1f82847d3f77beca4cb2f3cd188b572a9ed8a6ed3789b73048daf3c`

The preceding image was:

`sha256:1fbcb3c6e94c2e9d972a685a08dd66d6ba5d819636e7440e36158686f590f923`

All 938 server modules, 12 shared modules, Node/runtime versions, root package
metadata, 110 npm packages, 151 APK packages and six mapped native binary hashes
match. All 155 packaged client files match the current local build; 56 differ
from the preceding bundle, including generated hash/import changes. Reviewed
runtime source edits are one workspace and two small new client modules.
Dependencies, lockfile, version and production backend are unchanged.

Started Compose with `up -d --wait --no-build`, ran/retired the existing-admin
bootstrap helper and passed authenticated readiness. Temporary password material
was removed. Existing administrator/data and all five actual bind sources/access
modes match: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and read-only root.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0. Builder, bootstrap and inventory/
identity helpers were removed and absence checked. Browser runtimes completed
awaited cleanup; no Testcontainers containers remained afterward.

Private logs, mounts, inventories, readiness, browser observations/screenshots,
native identity and final audit records live under
`.tmp/recovery-diagnostic-events-2026-10-25/`. Readiness establishes no new
provider transfer/import acceptance. No service, schema, branch or release was created.
