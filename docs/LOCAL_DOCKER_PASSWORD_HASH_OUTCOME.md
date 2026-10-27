# Versioned password hashes local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:4ff700e46f1a6af25da2bce1635f47f27b71b177b8fd57b678918fa1e6549be7`

It replaced image
`sha256:132d7aad2b5bbfebc90ac55974c4b11c33477df90693a949d012bf940e6ab0cd`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy,
root read-only and UID 1000. Existing-administrator authentication, existing-user
bootstrap handling and readiness passed without resetting the password. A legacy
administrator hash can upgrade through normal authentication.

All five read/write bind destinations and inspected sources were preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`.
The actual downloads override was forwarded during recreation. The disposable
builder, bootstrap helper and temporary private password file were retired.
Unrelated user containers were not changed.

Exact runtime comparison found four intended server changes:
`password-hash-policy.js`, `password-login-service.js`, `password-login-store.js`
and `password-work-service.js`. The image contains 1,018 server, 156 client and
13 shared files. Other server/shared bytes and modes and all client bytes match
the preceding image; assets match the local build. All 110 npm and 151 OS package
records, Node provenance and entrypoint bytes/mode are unchanged. Runtime remains
Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1, PostgreSQL 18.6 and pg
8.23.1. Startup applied zero migrations, verifying 115 applied and zero pending.
The snapshot and 164-anchor contract remain unchanged.

Ten fresh packaged native entries passed: hash upgrades and password work each
at 2 and 3 GiB, then auth reads, session admission, failure, ordinary login,
rotation and replay at 3 GiB. Each used network isolation, read-only root, UID
1000, two CPUs, matching memory/swap cap, 256 PIDs and private tmpfs database/media.
Application modules came from the immutable image. All exited zero, were removed
and had exact absence verified. The [implementation outcome](PASSWORD_HASH_OUTCOME.md)
records 136 scenario executions, sampled RSS, concurrency and controlled-fault
limits. Source-overlay preflight evidence is separate from these final runs.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current status with 164 anchors, no-store and one request. Focus remained
in place, no manual schema button appeared and mobile content fit without
overflow. Desktop/mobile screenshots were visually inspected. No new screen-reader
or physical-device acceptance is claimed. The Linux data-bind private publication,
readiness, directory-sync, collision and cleanup probe passed; its owned child
directory was removed.

Private evidence: `.tmp/password-hash-2026-10-27/`. See the
[Docker design](LOCAL_DOCKER_PASSWORD_HASH_DESIGN.md) and
[official research/tradeoffs](PASSWORD_HASH_RESEARCH_2026_10.md).
Work remains on main without a release, tag, separate branch or PR merge.
