# Session replay local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:625ea3469f9b44b7e2f3079928d3091f28da1ae31376443a94f6d7bdd7736391`

The comparison baseline is the preceding published candidate
`sha256:cca7078e92f9534de4f5f3d66d5eff2902a489e01bec1a212f79f33049adaa8d`
at **http://127.0.0.1:47956**. The final single walkthrough service is healthy,
read-only and UID 1000. Existing administrator login/readiness and bootstrap
existing-user handling passed without resetting credentials.

All five inspected read/write bind destinations and original source paths were
preserved: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, and
`/data/transcode-temp`. The downloads override was carried from actual inspection.
The temporary bootstrap helper, builder and password file were retired/removed.
Unrelated containers were not changed.

The image contains 999 server, 156 client and 13 shared files. Full comparison
found exactly four changed server paths: `auth.js` and the three new replay
modules. All other server/shared hashes and modes and all client bytes match the
previous image. The client also matches the final local production build. All
110 npm and 151 OS package records, Node binary/provenance and entrypoint bytes/
mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2, PostgreSQL 18.6 and
pg 8.23.1. No migration, schema snapshot or anchor contract changed.

Three fresh packaged PostgreSQL entries passed: thirteen replay scenarios, ten
session/pool scenarios and the diagnostics HTTP controls. Each exited 0 under
the documented restricted 3 GiB/2 CPU profile, was removed, and had exact absence
verified. No source overlay supplied final application code. See
[implementation outcome](SESSION_REPLAY_OUTCOME.md) for precise claims and the
controlled commit-acknowledgement limitation.

The existing Linux data-bind private publication/link/readiness/directory-sync/
collision/cleanup probe passed. The existing-admin Chromium smoke observed one
explicit no-store diagnostic refresh, all 164 anchors current, preserved refresh
focus and no mobile overflow. Desktop/mobile screenshots were visually reviewed.
Manual screen-reader/device acceptance remains deferred as previously requested.

Evidence is private under `.tmp/session-replay-2026-10-27/`. No release or tag
was published. See [Docker design](LOCAL_DOCKER_SESSION_REPLAY_DESIGN.md) and
[official recommendations](SESSION_REPLAY_RESEARCH_2026_10.md).
