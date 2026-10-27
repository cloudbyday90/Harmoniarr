# Failed-login local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:33677755e6d9d9f7c4dfd57df3bad2874b4b430c2f1a551db05715585e167793`

It replaced the preceding qualified image
`sha256:077da55f28d080ab54a8e2767eb1f6d14bae79ecca34352f73a06a0d3536a104`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy, root
read-only and UID 1000. Existing administrator login, existing-user bootstrap
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. The temporary
builder, bootstrap helper and private password file were retired. Unrelated user
containers were not changed.

Runtime comparison found exactly five changed server paths: `auth.js`,
`password-login-service.js`, `login-failure-service.js`, `login-failure-store.js`
and `validators/auth-validator.js`. The image contains 1,012 server, 156 client
and 13 shared files. All other server/shared bytes and modes and all client bytes
match the preceding image; packaged assets match the final local build. All 110
npm and 151 OS package records, Node provenance and entrypoint bytes/mode are
unchanged. Runtime remains Node 24.22.1, npm 12.0.2, PostgreSQL 18.6 and pg 8.23.1.
The 115 migrations, snapshot and 164-anchor contract are unchanged.

Four fresh packaged PostgreSQL entries passed: twenty failure, sixteen successful
password-login, fifteen rotation and thirteen replay scenarios. Each ran with
network disabled, read-only root, UID 1000, 2 CPU, 3 GiB memory/swap, PIDs 256 and
private tmpfs database/storage. All exited 0, were removed and had exact absence
verified. Application modules came from the immutable image. The
[implementation outcome](LOGIN_FAILURE_OUTCOME.md) states precise claims and the
controlled acknowledgement-loss limitation.

The live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current schema status with 164 anchors, no-store and one request. Focus
remained in place, the manual schema button remained absent and mobile content
fit without overflow. Desktop/mobile screenshots were visually inspected; no new
assistive-technology acceptance is claimed. The Linux data-bind private
publication/readiness, directory-sync, collision and cleanup probe passed and its
owned child directory was removed.

Evidence is private under `.tmp/login-failure-2026-10-27/`. No release, tag or PR
merge was performed. See the [Docker design](LOCAL_DOCKER_LOGIN_FAILURE_DESIGN.md)
and [official research/tradeoffs](LOGIN_FAILURE_RESEARCH_2026_10.md).
