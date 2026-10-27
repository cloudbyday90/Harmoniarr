# Password work local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:132d7aad2b5bbfebc90ac55974c4b11c33477df90693a949d012bf940e6ab0cd`

It replaced the preceding qualified image
`sha256:2c4ff3f35fbc57e08c5ad2cf6b1ddfdaf1ef5e4b51c4d357a87c4874fb679618`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy,
root read-only and UID 1000. Existing administrator login, existing-user bootstrap
handling and readiness passed without resetting credentials.

All five read/write bind destinations and inspected source paths were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. Temporary builder,
bootstrap helper and private password file were retired. Unrelated user containers
were not changed.

Runtime comparison found exactly four changed server paths: `security.js`,
`validators/auth-validator.js`, `password-input-policy.js` and
`password-work-service.js`. The image contains 1,017 server, 156 client and
13 shared files. All other server/shared bytes/modes and all client bytes match
the preceding image; assets match the final local build. All 110 npm and 151 OS
package records, Node provenance and entrypoint bytes/mode are unchanged. Runtime
remains Node 24.22.1, npm 12.0.2, PostgreSQL 18.6 and pg 8.23.1. The 115 migrations,
snapshot and 164-anchor contract are unchanged.

Eight fresh packaged native entries passed: password work at 2 and 3 GiB, then
auth-read/session/failure/login/rotation/replay at 3 GiB. Each ran with network
disabled, read-only root, UID 1000, 2 CPU, matching memory/swap cap, PIDs 256 and
private tmpfs database/storage. All exited 0, were removed and had exact absence
verified. Application modules came from the immutable image. The
[implementation outcome](PASSWORD_WORK_OUTCOME.md) records 106 scenario executions,
sampled RSS, controlled-barrier limits and the stronger-KDF followup.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current status with 164 anchors, no-store and one request. Focus remained
in place, the manual schema button remained absent and mobile content fit without
overflow. Desktop/mobile screenshots were visually inspected; no new assistive-
technology acceptance is claimed. The Linux data-bind private publication/
readiness, directory-sync, collision and cleanup probe passed and its owned child
directory was removed.

Evidence is private under `.tmp/password-work-2026-10-27/`. No release, tag or PR
merge was performed. See the [Docker design](LOCAL_DOCKER_PASSWORD_WORK_DESIGN.md)
and [official research/tradeoffs](PASSWORD_WORK_RESEARCH_2026_10.md).
