# Atomic password change local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:767c12213dfac5f5483f57c5774fd084930befb399d18c04a5b0a5470ce17a04`

It replaced
`sha256:4ff700e46f1a6af25da2bce1635f47f27b71b177b8fd57b678918fa1e6549be7`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy,
root read-only and UID 1000. Existing-administrator authentication, existing-user
bootstrap handling and readiness passed without changing the operator password.
Password changes were exercised against disposable fixture accounts.

All five inspected read/write bind sources were preserved at `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`. The
actual downloads override was forwarded during recreation. Builder, bootstrap
helper and temporary private-password file were retired. Unrelated user
containers were not changed.

Exact packaged comparison found three intended server changes:
`account-security-service.js`, `password-change-service.js` and
`password-change-store.js`. The image contains 1,020 server, 156 client and 13
shared files. Other server/shared bytes/modes and all client bytes match the
preceding image; assets match the local production build. All 110 npm and 151
OS package records, Node provenance and entrypoint bytes/mode are unchanged.
Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1,
PostgreSQL 18.6 and pg 8.23.1. Startup applied zero migrations and verified 115
applied, zero pending. The snapshot and 164-anchor contract are unchanged.

Ten fresh immutable-image entries passed: password change at 2 and 3 GiB;
hash upgrades, password work, auth reads, session admission, failure, login,
rotation and replay at 3 GiB. Each ran network-isolated with read-only root,
UID 1000, two CPUs, equal memory/swap caps, 256 PIDs and private tmpfs data/media.
No final run overlaid application binaries. All exited zero, were removed and
were checked absent. The [implementation outcome](PASSWORD_CHANGE_OUTCOME.md)
records 167 scenario executions, actual SQL waits/retirement and controlled-fault
limits. The unchanged KDF/native policy retains its prior resource proof.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current status with 164 anchors, no-store and one request. Focus remained
in place, no manual schema button appeared and mobile content fit without
overflow. Desktop/mobile screenshots were visually inspected. Native HTTP tests
own password-change success/refusal proof; the existing operator credential was
preserved. No new screen-reader/physical-device acceptance is claimed.
The private Linux data-bind publication/readiness/directory-sync/collision probe
passed and removed its owned child directory.

Private evidence: `.tmp/password-change-2026-10-27/`. See the
[Docker design](LOCAL_DOCKER_PASSWORD_CHANGE_DESIGN.md) and
[research/tradeoffs](PASSWORD_CHANGE_RESEARCH_2026_10.md).
Work remains on main without a release, tag, separate branch or PR merge.
