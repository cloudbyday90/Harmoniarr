# Preliminary authentication read local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:2c4ff3f35fbc57e08c5ad2cf6b1ddfdaf1ef5e4b51c4d357a87c4874fb679618`

It replaced the preceding qualified image
`sha256:33677755e6d9d9f7c4dfd57df3bad2874b4b430c2f1a551db05715585e167793`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy, root
read-only and UID 1000. Existing administrator login, existing-user bootstrap
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. The temporary
builder, bootstrap helper and private password file were retired. Unrelated user
containers were not changed.

Runtime comparison found exactly ten changed server paths: auth, the new lookup
service/store and request-read signal helper, bootstrap status, password login
service/store, auth routes and session lookup owner/service. The image contains
1,015 server, 156 client and 13 shared files. All other server/shared bytes and
modes and all client bytes match the preceding image; assets match the final
local build. All 110 npm and 151 OS package records, Node provenance and
entrypoint bytes/mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2,
PostgreSQL 18.6 and pg 8.23.1. The 115 migrations, snapshot and 164-anchor contract
are unchanged.

Six fresh packaged PostgreSQL entries passed: sixteen auth-read, ten session,
twenty failure, sixteen password-login, fifteen rotation and thirteen replay
scenarios. Each ran with network disabled, read-only root, UID 1000, 2 CPU,
3 GiB memory/swap, PIDs 256 and private tmpfs database/storage. All exited 0,
were removed and had exact absence verified. Application modules came from the
immutable image. The [implementation outcome](AUTH_LOOKUP_OUTCOME.md) states
precise claims and the controlled-interleaving limitations.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current status with 164 anchors, no-store and one request. Focus remained
in place, the manual schema button remained absent and mobile content fit without
overflow. Desktop/mobile screenshots were visually inspected; no new assistive-
technology acceptance is claimed. The Linux data-bind private publication/
readiness, directory-sync, collision and cleanup probe passed and its owned child
directory was removed.

Evidence is private under `.tmp/auth-lookup-2026-10-27/`. No release, tag or PR
merge was performed. See the [Docker design](LOCAL_DOCKER_AUTH_LOOKUP_DESIGN.md)
and [official research/tradeoffs](AUTH_LOOKUP_RESEARCH_2026_10.md).
