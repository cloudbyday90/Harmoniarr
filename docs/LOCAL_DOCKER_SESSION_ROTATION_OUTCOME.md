# Session rotation local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:a829369691c39f72e03036784d1d2e56e5e9f529c3bf4ff2080a15a30a646efc`

It replaced the preceding qualified candidate
`sha256:625ea3469f9b44b7e2f3079928d3091f28da1ae31376443a94f6d7bdd7736391`
at **http://127.0.0.1:47956**. The single walkthrough service is healthy, root
read-only and UID 1000. Existing administrator login, bootstrap existing-user
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. The old binary
was stopped rather than mixed with nonparticipating legacy issuers. The bootstrap
helper, temporary builder and private password file were retired. Unrelated user
containers were not changed.

Full runtime comparison found exactly eleven changed server paths: auth and its
refresh route, replay service/adapter, shared write owner, family lock store,
issuance service/store/policy, selected audit metadata and session-user projection.
The image has 1,006 server, 156 client and 13 shared files. All other server/shared
bytes and modes and all client bytes match the prior image; client output matches
the final local build. All 110 npm and 151 OS package records, Node provenance and
entrypoint bytes/mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2,
PostgreSQL 18.6 and pg 8.23.1. No migration, snapshot or anchor contract changed.

Four fresh packaged PostgreSQL entries passed: fifteen rotation scenarios,
thirteen replay scenarios, ten session/pool scenarios and diagnostics HTTP controls.
Each exited 0 in its restricted container, was removed and had exact absence
verified. Final application code came from the immutable image. See
[implementation outcome](SESSION_ROTATION_OUTCOME.md) for precise claims and the
controlled commit-acknowledgement limitation.

Existing-admin Chromium checks confirmed the existing saved CSRF `disabled`
opt-out remained in effect, then passed valid-header refresh/current-user response
and updated cookies, followed by one explicit no-store
schema refresh with all 164 anchors current, retained focus and no mobile overflow.
Desktop/mobile screenshots were visually inspected. No new assistive-technology
acceptance is claimed. The Linux data-bind private publication/readiness/directory-
sync/collision/removal probe also passed and its owned directory was removed.
Required-mode missing/invalid-header refusal passed in the fresh PostgreSQL/native
and HTTP integration fixtures. It is not claimed for the opted-out walkthrough;
required CSRF remains the recommended deployment policy.

Evidence is private under `.tmp/session-rotation-2026-10-27/`. No release, tag or
PR merge was performed. See [Docker design](LOCAL_DOCKER_SESSION_ROTATION_DESIGN.md)
and [official research/tradeoffs](SESSION_ROTATION_RESEARCH_2026_10.md).
