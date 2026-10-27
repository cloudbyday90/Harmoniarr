# Automatic schema maintenance local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:2181a594abfb227a08ca9696112573558ed1c623016cf5be7a3c56f3b0b67779`

It replaced the preceding qualified image
`sha256:a829369691c39f72e03036784d1d2e56e5e9f529c3bf4ff2080a15a30a646efc`
at **http://127.0.0.1:47956**. The single walkthrough service is healthy, root
read-only and UID 1000. Existing administrator login, existing-user bootstrap
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. The temporary
builder, bootstrap helper and private password file were retired. Unrelated user
containers were not changed.

Runtime comparison found exactly eight changed server paths: the new maintenance
owner, diagnostics service/route, observation store, drift service, system module,
startup runtime and application worker drain. The image contains 1,007 server,
156 client and 13 shared files. All other server/shared bytes and modes match the
prior image. Fifty-six client paths changed through the UI and generated chunk
names; all packaged client assets match the final local build. All 110 npm and
151 OS package records, Node provenance and entrypoint bytes/mode are unchanged.
Runtime remains Node 24.22.1, npm 12.0.2, PostgreSQL 18.6 and pg 8.23.1. The 115
migrations, schema snapshot and 164-anchor contract are unchanged.

Two fresh packaged PostgreSQL entries passed: automatic maintenance/HTTP behavior
and all 16 existing drift scenarios. Each exited 0 in its restricted container,
was removed and had exact absence verified. Application code came from the
immutable image. The [implementation outcome](AUTO_SCHEMA_MAINTENANCE_OUTCOME.md)
records the maintenance, authorization, observer and drainage claims.

The existing-admin Chromium check opened diagnostics and automatically loaded
current status with all 164 anchors, no-store and one request. There was no manual
schema button; focus remained in place and mobile content did not overflow.
Desktop/mobile screenshots were visually inspected. No new assistive-technology
acceptance is claimed. The Linux data-bind private publication/readiness,
directory-sync, collision and cleanup probe passed; its owned directory was
removed.

Evidence is private under `.tmp/schema-maintenance-2026-10-27/`. No release, tag or
PR merge was performed. See the [Docker design](LOCAL_DOCKER_AUTO_SCHEMA_MAINTENANCE_DESIGN.md)
and [official research/tradeoffs](AUTO_SCHEMA_MAINTENANCE_RESEARCH.md).
