# Automatic Plex retention local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:0a8b27fed647d0bb93debfea2fa83bf6596bfbf6f035fda4d7d8317ed37ac934`

It replaced
`sha256:7fd5b88f2ecbe90567fa14ce7e4ab66fc3549c4a08a7eb8cd589cfe167959dc2`
at **http://127.0.0.1:47956**. The existing single walkthrough application is
healthy, root read-only and UID 1000. Its existing administrator and operator
credentials were preserved. Readiness and already-provisioned bootstrap handling
passed. All five inspected read/write bind sources were preserved at `/app/data`,
`/data/downloads`, `/data/music`, `/data/staging` and `/data/transcode-temp`;
recreation forwarded the actual downloads override. Eligible pending-state
disposal is now the intended automatic maintenance behavior.

The fresh builder, bootstrap helper and temporary private-password file were
retired. Unrelated user containers were not changed. Test applications/databases
were disposable fixtures, with no second deployed application or manual endpoint.
See the separate [Docker design](LOCAL_DOCKER_PLEX_RETENTION_DESIGN.md).

## Image and retained evidence

The seven changed production paths are `application-worker-drain.js`,
`startup-runtime.js`, `system-module.js` and the four new Plex callback retention/
maintenance modules. All match frozen source. The image contains **1,032 server,
156 client and 13 shared files**. Every other server/shared byte and mode is
unchanged; client bytes are unchanged and match the local production build.
All **110 npm and 151 OS package records**, Node binary provenance and entrypoint
bytes/mode are unchanged. Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9,
undici 7.30.1, PostgreSQL 18.6 and pg 8.23.1. Startup applied zero migrations,
verifying 115 applied and zero pending. Snapshot and 164-anchor contract are
unchanged. The [implementation outcome](PLEX_RETENTION_OUTCOME.md) records the
3,758-file source fingerprint and 11,513-test final fast gate.

Unchanged password/KDF/session, native media and secure-cookie browser evidence
is retained after exact source/test/packaged-runtime review. This is retained
evidence, not a new execution of those whole matrices, production TLS/live Plex
acceptance or a new minimum-memory/throughput claim. New retention interaction
with active callback publication is covered below.

## Fresh immutable native entries

| Entry | Scenarios |
| --- | ---: |
| Callback retention, maintenance ownership and lifecycle | 14 |
| Browser-bound single-use callback | 19 |
| Linked-provider login | 23 |
| **Total** | **56** |

All three passed at 3 GiB with matching memory/swap caps, two CPUs, 256 PIDs,
UID 1000, read-only root, no network/ports and private tmpfs database/media.
Each exited zero and was removed with absence verified. Tests/helper inputs were
mounted read-only; final application binaries were not overlaid.

The retention entry exercises real PostgreSQL row/table/advisory ownership,
required audit, rollback, concurrent replacement, active provider completion,
controlled commit acknowledgement loss and actual backend retirement. Its
runtime uses the real supervisor registration/start path while filtering unrelated
background services in the disposable fixture. The production component runs
automatically at startup and every five minutes. Trigger/barrier and controlled
transport evidence covers specified schedules, not every race or a physical
network failure. The initial preflight's missing bootstrap request metadata was
fixed; its exact failed fixture was retired separately from final evidence.

## Live browser and cleanup

Existing-admin Chromium login passed against the live walkthrough. Opening
diagnostics automatically loaded current migration/schema state with 164 anchors,
no-store and one request. Focus remained on the disclosure control, no manual
schema button appeared and mobile content fit without overflow. Desktop/mobile
screenshots were visually inspected. The packaged Linux data-bind publication,
readiness, directory-sync and collision probe passed and removed its owned child
directory. No new screen-reader or physical-device acceptance is claimed.

Private evidence: `.tmp/plex-retention-2026-10-27/`. GitHub MCP found no open PRs,
including Dependabot PRs, at initial and final checks. No random PR application,
rebase or stale-PR closure was applicable; none was merged. Work remains on main
with no release, tag or separate branch. The
[official research/tradeoffs](PLEX_RETENTION_RESEARCH_2026_10.md) recommends bounded
Plex HTTP time/body/drain ownership as the next item.
