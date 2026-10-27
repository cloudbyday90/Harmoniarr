# Plex callback local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:7fd5b88f2ecbe90567fa14ce7e4ab66fc3549c4a08a7eb8cd589cfe167959dc2`

It replaced
`sha256:ca8ebc53152ef68feb1a3b493f77559720e023d54c5164a8d7f0eb7785d53e8d`
at **http://127.0.0.1:47956**. The existing single walkthrough application is
healthy, root read-only and UID 1000. Its administrator, operator credentials and
data were preserved. Readiness and the bootstrap helper's already-provisioned
path passed. The helper, fresh builder and temporary private-password file were
retired. No unrelated container was changed.

All five inspected read/write bind sources were preserved at `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`.
Recreation forwarded the actual existing downloads override. This is the existing
application; test applications/databases were disposable fixtures only.

## Packaged identity

Eight intended production paths changed: encrypted-secret service, callback
policy/state service/state store, Plex sign-in adapter, linked-login service,
browser-binding helper and auth routes. All match frozen source. The image has
1,028 server, 156 client and 13 shared files. Other server/shared bytes and modes
are unchanged; client bytes are unchanged and match the local production build.
All 110 npm and 151 OS package records, Node binary provenance and entrypoint
bytes/mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9,
undici 7.30.1, PostgreSQL 18.6 and pg 8.23.1. Startup applied zero migrations,
verifying 115 applied and zero pending. The snapshot and 164-anchor contract are
unchanged. The [implementation outcome](PLEX_CALLBACK_OUTCOME.md) records the
3,752-file source fingerprint and 11,505-test fast gate.

## Immutable-image native checks

| Entry | Scenarios |
| --- | ---: |
| Browser-bound callback state | 19 |
| Linked-provider login | 23 |
| Password change | 27 |
| Password-hash upgrade | 15 |
| Password work/admission | 8 |
| Auth lookup | 16 |
| Session admission | 10 |
| Login failure bookkeeping | 20 |
| Password login | 16 |
| Session rotation | 15 |
| Session replay | 13 |
| **Total** | **182** |

All eleven entries passed at 3 GiB, two CPUs, matching memory/swap caps,
256 PIDs, UID 1000, read-only root, no network/ports and private tmpfs data/media.
Each exited zero and was removed with absence verified. Final runs used the
packaged implementation, without source overlays. Actual PostgreSQL state,
invisibility/rollback, competing callbacks, expiry, required audit, controlled
commit-acknowledgement loss and backend retirement were exercised. Prior unchanged
KDF/worker resource qualification is retained after exact runtime/source review;
these correctness checks do not establish a new memory minimum or throughput.

## Browser, deployment and cleanup

The separate disposable HTTPS browser fixture used the same immutable image,
controlled Plex transport and real temporary PostgreSQL. Two fresh Chromium
contexts verified the Secure `__Host-` HttpOnly host-only Path=/ Lax cookie,
script exclusion, real cross-site top-level return, refusal without the original
browser binding, successful original-browser completion, independent tabs and
replay without replacing a session cookie. The simulated provider never received
the verifier cookie. Its application exited zero through graceful owned shutdown;
the exact container and private bridge were removed and checked absent. Browser
contexts and host loopback proxy/provider servers closed.

The public fixture certificate chain exception was scoped to disposable browser
contexts; no CA was installed. This is cookie/navigation evidence, not trusted
production TLS or live Plex acceptance. The private bridge published only a
random loopback port; WAN isolation is not claimed for this browser fixture.
Native fixtures had no network. The [Docker design](LOCAL_DOCKER_PLEX_CALLBACK_DESIGN.md)
records the containment and saved secure-cookie policy setup.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current migration/schema status with 164 anchors, no-store and one request.
Focus stayed on the disclosure control; no manual schema button appeared and
mobile content fit without overflow. Desktop/mobile screenshots were visually
inspected. The packaged Linux data-bind publication/readiness/directory-sync/
collision probe passed and removed its owned child directory. No new manual
screen-reader or physical-device acceptance is claimed.

Failed preflights are retained separately: a native observer initially used
global pool occupancy under concurrent work, while early browser setup used an
internal Docker network without a published port and did not consistently persist
its secure-cookie setting. Per-call actual checkout/release tracking, abort-aware
barriers, correct fixture settings and graceful app-owner shutdown fixed the
qualification boundary. Failed fixtures were retired; no production deadline or
application security policy was weakened.

Private evidence: `.tmp/plex-callback-2026-10-27/`. See the separate
[official research/tradeoffs](PLEX_CALLBACK_RESEARCH_2026_10.md) and
[implementation design](PLEX_CALLBACK_DESIGN.md). Work stays on main with no
release, tag, separate branch or PR merge. GitHub MCP found no open PRs, including
Dependabot PRs, so no random PR application or stale-PR cleanup was applicable.
