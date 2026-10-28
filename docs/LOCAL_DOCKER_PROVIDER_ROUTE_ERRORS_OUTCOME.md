# Provider route error Docker outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_PROVIDER_ROUTE_ERRORS_DESIGN.md)
and [implementation outcome](PROVIDER_ROUTE_ERRORS_OUTCOME.md).

## Packaged candidate and preserved walkthrough

The healthy walkthrough at http://127.0.0.1:47956 runs immutable image
`sha256:2cc06bb8d11a3875b586dbd7d1db8deafee4ea7171d85b4cf677c29880ccfd96`.
A disposable pull/no-cache builder was removed after producing it. The existing
administrator and all five actual bind sources were preserved. Read-only root,
Linux x64 UID 1000, health and the packaged readiness command passed. Bootstrap
was retired and temporary password material removed. Startup reported 115 applied
migrations, zero pending and zero newly applied. No schema refresh was requested.

Compared with the preceding HTTP-error image
`sha256:6ba2e8c275b5dd0f4822eecd2858e9b9f2617c4a378392bc73bef15835799f5f`,
the packaged differences are exactly the new provider policy and four route
adapters. Other server/shared files and modes retain their identity; 56 client
files change through the single Downloader view rebuild and hashed chunk links.
All 1,058 server, 156 client and 13 shared files were inventoried. The packaged
client equals the local production build; shared and root metadata match source.
All 110 npm and 151 OS package entries are unchanged. Node 24.22.1 and its binary
hash, npm 12.0.2, OpenSSL 3.5.9 and Undici 7.30.1 are unchanged. No release is created.

## Final evidence and ownership

Private evidence is under `.tmp/provider-route-errors-2026-10-28/complete/`:

| Evidence | Result and limit |
| --- | --- |
| `fast/gate-result.json` | All 14 selected stages passed; 11,655 tests, zero skips. |
| `final-routes-result.json`, `final-http-result.json` | Two native tests passed, with 31 provider and 20 global-error scenario groups, on the exact final image. |
| Corresponding retirement records | Exact native containers removed and absence verified. |
| `runtime-comparison.json`, inventories | Exact source/build/package differences described above. |
| `before-mounts.json`, `after-mounts.json`, `walkthrough-result.json` | Five mount identities preserved, healthy existing administrator, read-only UID 1000 and readiness passed. |
| `entrypoint-identity.json` | Before/after entrypoint bytes/mode match current source; probe helpers retired. |
| `data-bind-probe.json` | Packaged data-bind file/directory creation, sync, exclusive publication, collision and owned cleanup checks passed. |
| `live-browser.json` | Actual administrator login and automatic schema status load: 164 current anchors, one no-store request, no manual schema button, focus and mobile overflow checks passed. |
| `browser-final/route-browser.json` and four PNGs | Nine browser groups passed; five artwork POSTs locally fulfilled, no mutation forwarded, unchanged settings, preserved focus/guards/recovery, no page errors or overflow. Four screenshots visually reviewed. |
| `browser-final/canonical-browser.log` | Canonical disposable browser entry passed, eight controlled groups, zero skips. |
| `retained-runtime.json` | Exact post-gate fixture-only change and retained runtime/test identity. |

Final native qualification used actual packaged app/auth/PostgreSQL, no server or
client overlays, no external network or published ports, fresh database/media
tmpfs, read-only UID 1000, two CPUs and 3 GiB memory with equal swap. Controlled
provider failures are injected through existing module composition in the test;
there are no production fixture routes or live download/search commands. Real
PostgreSQL termination affected only the fixture-owned backend, with end and
absence checked before cleanup. Settings, encrypted secrets, relevant settings
audit and operation rows remained equal around controlled reads/refusals.

The full gate and packaged native runs froze 3,818 source files at
`ab721385946dd8bc239cf7bdd30ad40765a76d72c396ced3fa1d8b0a2148e6f3`.
The final browser helper adds only an exact local artwork POST response fixture,
required by populated walkthrough data. All other 14 changed code files are
byte-identical, including every production and native-test file. The final source
fingerprint is `1a4a0faa9b1f78416daa6f9aca443496289a68a46c408116e94c2fc66c86bc22`.
Canonical browser, populated browser, lint and hygiene passed after that change.
The full gate/image/native proof is retained for the unchanged implementation.

The initial server-only image and failed preflights remain separate in the parent
evidence directory. Failed focus/fixture assertions and the later read-only guard
refusal are preserved, then corrected and rerun; they are not database outage
diagnoses or passing measurements. The outcome counts each final scenario once.
Unchanged provider transport, SQL and media matrices retain earlier exact-runtime
proof; they were not repeated for this route policy.

This profile does not establish a minimum RAM setting, complete native matrix,
whole-application drainage, live provider acceptance, spoken screen-reader or
physical-device acceptance. Manual accessibility checks remain user-deferred.
The next scoped item is fixed OAuth/Plex redirect error codes, as recorded in the
[implementation outcome](PROVIDER_ROUTE_ERRORS_OUTCOME.md).
