# Password login local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:077da55f28d080ab54a8e2767eb1f6d14bae79ecca34352f73a06a0d3536a104`

It replaced the preceding qualified image
`sha256:2181a594abfb227a08ca9696112573558ed1c623016cf5be7a3c56f3b0b67779`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy, root
read-only and UID 1000. Existing administrator login, existing-user bootstrap
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. Temporary builder,
bootstrap helper and private password file were retired. Unrelated user containers
were not changed.

Runtime comparison found exactly five changed server paths: `auth.js`,
`session-issuance-service.js`, `password-login-service.js`, `password-login-store.js`
and `session-root-publication-service.js`. The image contains 1,010 server,
156 client and 13 shared files. All other server/shared bytes and modes and all
client bytes match the preceding image; packaged assets match the final local
build. All 110 npm and 151 OS package records, Node provenance and entrypoint
bytes/mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2, PostgreSQL 18.6
and pg 8.23.1. The 115 migrations, snapshot and 164-anchor contract are unchanged.

Three fresh packaged PostgreSQL entries passed: sixteen password-login scenarios,
fifteen rotation scenarios and thirteen replay scenarios. Each ran with network
disabled, read-only root, UID 1000, 2 CPU, 3 GiB memory/swap, PIDs 256 and private
tmpfs database/storage. All exited 0, were removed and had exact absence verified.
Application modules came from the immutable image. The
[implementation outcome](PASSWORD_LOGIN_OUTCOME.md) states the precise claims and
controlled commit-acknowledgement limitation.

The live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current schema status with 164 anchors, no-store and one request. Focus
remained in place, the manual schema button remained absent and mobile content
fit without overflow. Desktop/mobile screenshots were visually inspected; no
new assistive-technology acceptance is claimed. The Linux data-bind private
publication/readiness, directory-sync, collision and cleanup probe passed and its
owned child directory was removed.

Evidence is private under `.tmp/password-login-2026-10-27/`. No release, tag or PR
merge was performed. See the [Docker design](LOCAL_DOCKER_PASSWORD_LOGIN_DESIGN.md)
and [official research/tradeoffs](PASSWORD_LOGIN_RESEARCH_2026_10.md).
