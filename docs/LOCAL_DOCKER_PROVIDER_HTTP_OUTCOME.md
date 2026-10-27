# Local Docker provider HTTP qualification outcome

October 27, 2026. See the separate
[qualification design](LOCAL_DOCKER_PROVIDER_HTTP_DESIGN.md),
[implementation outcome](PROVIDER_HTTP_OUTCOME.md) and
[official research/tradeoffs](PROVIDER_HTTP_RESEARCH_2026_10.md).

## Frozen source and fresh image

Source fingerprint: 3,787 files,
`3ac894ae4355ff869fa1b9352d3ee800872bfea729a6b0f37457133dc6e63a4f`.
Twenty-four code/test/helper files were frozen before the final fourteen-stage
gate: 6,341 server + 4,504 client + 703 script/policy tests = 11,548 passes, zero
failures/skips/cancellations. Lint, ESM, copyright, migration/snapshot/anchors,
image/compose checks, hygiene and build passed. Production dependency audit
reported zero vulnerabilities.

Fresh pull/no-cache buildx image:
`sha256:3b91cd80b8761607886119342d0529f7597a4722757531814790934335c8ffff`.
Against prior image
`sha256:99153ea22c4c7eeab39812c76bf8461a04f0bf37ae2604ee20877b9ea4bdf38f`,
exact comparison found only eighteen intended server changes, including seven
new modules. There are 1,052 server, 156 client and 13 shared files. Client/shared
bytes match the local build/source; other packaged server files match the prior
image. All 110 npm and 151 OS package records are unchanged. Runtime provenance
remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici 7.30.1, with the
same Node binary and root package/lock metadata. The fresh builder was removed.

The read-only UID-1000 walkthrough is healthy on loopback port 47956. Existing
administrator and all five inspected bind sources, including the actual downloads
override, were preserved. Readiness and existing login passed. Startup verified
115 applied migrations, zero pending, applying none. The bootstrap helper retired
and the temporary readiness password file was removed. No second app was deployed.

## Packaged transport and publication evidence

Seven affected entries pass against that immutable image without overlays:

| Entry | Scenarios | Evidence scope |
| --- | --- | --- |
| Provider HTTP | 35 | Actual native TLS, bounded codecs, cancellation/DNS/socket retirement and mounted OAuth publication |
| Spotify/YouTube OAuth | 80 | Real PostgreSQL authority, state/revision, refresh and required-audit fences; controlled provider responses |
| Plex owner link | 33 | Current authority and atomic token/state/audit publication |
| Plex HTTP | 19 | Actual native transport after extracting the shared core |
| Plex callback | 19 | Browser-bound single-use state and local publication |
| Automatic retention | 14 | Bounded guarded cleanup, active-state preservation and audit atomicity |
| Linked login | 23 | Current provider identity and atomic session/bookkeeping/audit; unchanged entry passes on repeat |

The new provider entry observes forty request closes and forty socket closes for
forty issued requests, twenty-nine response closes and thirty-six successful TLS
handshakes, including refusal controls. Untrusted and trusted wrong-name TLS fail
before HTTP; private DNS and configured proxy controls refuse dispatch. The
redirect trap receives zero calls. A held real DNS callback retains the shared
slot and prevents shutdown completion until released.

Identity/gzip/deflate/Brotli success, exact output bound, declared/chunked/decoded
overflow, malformed/trailing/layered encoding, strict UTF-8/JSON, truncation and
header limits are exercised. Header/body/trickle stalls and active-body caller
cancellation retire native work. API-key/client-credentials callers use the owner.
Mounted Spotify and YouTube callbacks/refreshed-token readers preserve local
credentials/audit on native timeout and pass a controlled explicit retry. Stalled
Google revocation begins after committed local clear and retires afterward.

These fixtures use public test certificates and a test-only loopback connection
hook while retaining original Host/SNI and normal certificate/name verification.
They prove the packaged native boundary, not live Spotify/Google acceptance or
remote atomicity. Each guarded container is read-only UID-1000 with 3 GiB equal
memory/swap, two CPUs, 256 PIDs, no external network/ports and disposable database/
media tmpfs. Exact removal/absence is verified for every entry.

## Browser, retained checks and failed evidence

Separate Chromium Spotify and YouTube fixtures pass Secure host-only HttpOnly Lax
cookie, cross-site return without the Strict refresh cookie, legitimate success,
other-browser/older-tab refusal and replay without session replacement. The fake
provider never receives the browser-binding cookie. Default service readers
return null while unlinked and read the fresh linked token without another
exchange. Fixture-only TLS exceptions stay in browser contexts. Both fixture
processes exit zero; exact containers, networks, contexts and host servers retire.
These controlled-fetch browser flows do not supply default-native transport proof.

The live walkthrough passes existing administrator login, one automatic no-store
schema request, 164 current anchors, preserved focus and mobile no-overflow.
Desktop/mobile screenshots were reviewed. The packaged data-bind probe confirms
existing creation/publication/directory-sync behavior and removes its own probe.
Packaged entrypoint identity matches source. Unrelated password/session/KDF/media/
artwork qualification is retained after exact source/test/package/runtime review;
this is not fresh whole-container memory-capacity or live account qualification.
Human screen-reader and physical-device acceptance remains deferred.

The first full server gate had two obsolete YouTube exact-header assertions;
the corrected credential-selection assertions pass in the final frozen gate.
The first final-image linked-login invocation failed with
`plex_request_unavailable` at a controlled PIN request after its pool-exhaustion
case. It was removed and its failure log retained. A separately instrumented run
passed all 23 scenarios, observing zero acquired pool checkouts at all 33 provider
calls. A fresh repeat of the unchanged original entry also passed all 23 scenarios.
The failure remains unreproduced and unexplained; neither later pass establishes
its cause or that this HTTP change fixed it. No timeout, assertion or production
policy was weakened. The failed invocation is not counted as a pass.

Private evidence under `.tmp/provider-http-2026-10-27/` includes both frozen
candidate manifests, the failed and final gates, labeled native preflights,
immutable inventories, final native/browser results and cleanup, linked-login
failure/diagnostic/repeat records, screenshots, final manifest and post-push check.
Initial focused fixture/HTTP-classification issues were corrected before the
final freeze. Raw diagnostics remain private.

GitHub MCP initial/final searches found zero open PRs and zero Dependabot PRs;
none could be randomly applied, rebased or closed. No PR was merged, release/tag
created or separate branch used. Next extend this owned boundary to Apple Music;
capture the original controlled failure directly if the linked-login issue recurs.
