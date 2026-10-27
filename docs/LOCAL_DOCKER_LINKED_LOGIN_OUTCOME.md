# Linked provider login local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:ca8ebc53152ef68feb1a3b493f77559720e023d54c5164a8d7f0eb7785d53e8d`

It replaced
`sha256:767c12213dfac5f5483f57c5774fd084930befb399d18c04a5b0a5470ce17a04`
at **http://127.0.0.1:47956**. The single walkthrough application is healthy,
root read-only and UID 1000. Existing-administrator authentication, existing-user
bootstrap handling and readiness passed without changing operator credentials.
Provider sign-in was exercised using disposable accounts and controlled transport.

All five inspected read/write bind sources were preserved at `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging`, `/data/transcode-temp`; the
actual downloads override was forwarded during recreation. The disposable
builder, bootstrap helper and temporary private-password file were retired.
Unrelated user containers were not changed.

Exact packaged comparison found ten intended server changes: `app.js`, `audit.js`,
`auth.js`, `integrations/plex/plex-direct-sign-in-service.js`, the linked-login
policy/service/store, `login-bookkeeping-store.js`, `password-login-service.js`
and `password-login-store.js`. The image contains 1,024 server, 156 client and
13 shared files. Other server/shared bytes and modes and all client bytes match
the preceding image; assets match the local production build. All 110 npm and
151 OS package records, Node provenance and entrypoint bytes/mode are unchanged.
Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1,
PostgreSQL 18.6 and pg 8.23.1. Startup applied zero migrations, verifying 115
applied and zero pending. The snapshot and 164-anchor contract are unchanged.

Ten fresh immutable-image entries passed at 3 GiB: linked login, password change,
hash upgrade, password work, auth read, session admission, failure, ordinary
password login, rotation and replay. Each used network isolation, read-only root,
UID 1000, two CPUs, matching memory/swap caps, 256 PIDs and private tmpfs data/media.
No final run overlaid application binaries. All exited zero, were removed and
were checked absent. The [implementation outcome](LINKED_LOGIN_OUTCOME.md) records
163 scenario executions and actual SQL waits/retirement, including controlled
provider callback and suppressed required audit. Prior 2/3 GiB resource proof is
retained for unchanged KDF/worker policy; no new minimum-memory claim is made.

The real Plex client and encrypted pending-state store ran with controlled
response transport at the actual app factory/mounted callback boundary. Final
qualification never contacted live Plex; it is not remote TLS/provider acceptance
or single-use callback-state proof. Failed preflights and their retired containers
remain separate from final evidence.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current status with 164 anchors, no-store and one request. Focus remained
in place, no manual schema button appeared and mobile content fit without
overflow. Desktop/mobile screenshots were visually inspected. The private Linux
data-bind publication/readiness/directory-sync/collision probe passed and removed
its owned child directory. No new screen-reader/physical-device acceptance is
claimed.

Private evidence: `.tmp/linked-login-2026-10-27/`. See
[Docker design](LOCAL_DOCKER_LINKED_LOGIN_DESIGN.md) and
[official research/tradeoffs](LINKED_LOGIN_RESEARCH_2026_10.md).
Work remains on main without a release, tag, separate branch or PR merge.
