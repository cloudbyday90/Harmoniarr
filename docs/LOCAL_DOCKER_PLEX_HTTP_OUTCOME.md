# Owned Plex HTTPS local Docker outcome

October 27, 2026. A fresh `--pull --no-cache` build produced:

`sha256:3b29143b8c0e65f855491e36d98562ff9d25885e93582cf8c2346f28954c980a`

It replaced
`sha256:0a8b27fed647d0bb93debfea2fa83bf6596bfbf6f035fda4d7d8317ed37ac934`
at **http://127.0.0.1:47956**. The existing single walkthrough application is
healthy, root read-only and UID 1000. Its administrator and credentials were
preserved. Readiness and already-provisioned bootstrap handling passed. All five
inspected read/write bind sources were preserved at `/app/data`, `/data/downloads`,
`/data/music`, `/data/staging` and `/data/transcode-temp`; recreation forwarded the
actual downloads override. No additional deployed application was introduced.

The fresh builder, bootstrap helper and temporary private-password file were
retired. Unrelated user containers were not changed. See the separate
[Docker design](LOCAL_DOCKER_PLEX_HTTP_DESIGN.md).

## Packaged identity

Eight intended production paths changed: app/provider/startup/drain composition,
the Plex endpoint facade and three HTTP policy/transport/request modules. All match
frozen source. The image contains **1,035 server, 156 client and 13 shared files**.
Every other server/shared byte and mode is unchanged. Client bytes are unchanged
and match the local production build. All **110 npm and 151 OS package records**,
Node binary provenance and entrypoint bytes/mode are unchanged. Runtime remains
Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1, PostgreSQL 18.6 and
pg 8.23.1. Startup applied zero migrations, verifying 115 applied and zero pending;
the snapshot and 164-anchor contract are unchanged. The
[implementation outcome](PLEX_HTTP_OUTCOME.md) records the source fingerprint and
11,520-test final fast gate.

Unrelated password/KDF/session/media proof is retained after exact source/test/
runtime review. It is not a fresh execution of those entire matrices or a new
RSS/minimum-memory/throughput claim. Test/helper files and the public fixture
certificate are qualification inputs, not production TLS configuration.

## Fresh immutable native entries

| Entry | Scenarios |
| --- | ---: |
| Owned HTTPS, DNS, limits and mounted callback | 19 |
| Browser-bound single-use callback state | 19 |
| Callback retention and maintenance | 14 |
| Linked-provider login | 23 |
| **Total** | **75** |

All four passed at 3 GiB with matching memory/swap caps, two CPUs, 256 PIDs,
UID 1000, read-only root, no network/ports and private tmpfs database/media.
Each exited zero and was removed with absence verified. Final implementation
binaries came from the immutable image without source overlays.

The HTTPS entry uses real native HTTPS/TLS and PostgreSQL, with a loopback router
after controlled public DNS answers pass validation. A matching public fixture
certificate is trusted only by that router; native production options retain
the expected servername and rejectUnauthorized=true. Untrusted and trusted wrong-
name certificates refuse before HTTP token delivery. No global CA or TLS bypass
is installed. It observed **27 requests, 27 request closes, 27 socket closes and
23 verified TLS handshakes**, with zero redirect-trap calls. A held issued DNS
callback retained capacity and blocked shutdown after result timeout. Mounted
callback timeout issued no session/success audit/cookie; explicit retry succeeded.

Other entries use the adapted controlled-response helper for their existing
transaction schedules. Their HTTP responses contain public constants only and
are separate from native HTTPS evidence. No live Plex/public DNS acceptance,
arbitrary network-failure coverage, proxy/compression compatibility or complete
protocol-conformance claim is made.

## Fresh browser and cleanup

Because the internal transport seam changed, the secure-cookie browser fixture
was adapted and rerun against this image. Two isolated contexts verified the
Secure host-only HttpOnly Lax cookie, real cross-site top-level return, refusal in
another browser, original-browser success, independent tabs and replay without
replacing the session cookie. The simulated provider never received the binding.
Its loopback proxy used a certificate-chain exception only in the disposable
browser contexts, separate from the native lane's full TLS verification. The
fixture app exited zero and its exact container/private bridge were removed and
checked absent; contexts and proxy/provider servers closed.

Live existing-admin Chromium login passed. Opening diagnostics automatically
loaded current migration/schema state with 164 anchors, no-store and one request.
Focus remained on the disclosure control, no manual schema button appeared, and
mobile content fit without overflow. Desktop/mobile screenshots were visually
inspected. The packaged data-bind publication/readiness/directory-sync/collision
probe passed and removed its owned child directory. No new screen-reader or
physical-device acceptance is claimed.

Private evidence: `.tmp/plex-http-2026-10-27/`. Named preflights remain distinct
from final evidence and their fixtures were retired. The certificate-generation
helper did not remain after its failed CLI attempt; generation used explicit
local configuration and public test material. GitHub MCP found no open PRs,
including Dependabot PRs, at initial/final checks. There was none to apply, rebase
or close; none was merged. Work stays on main with no release, tag or branch.
Next: [owner-link callback admission/publication](PLEX_HTTP_OUTCOME.md).
