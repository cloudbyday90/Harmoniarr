# Local Docker provider HTTP qualification design

October 27, 2026. This validates the separate
[HTTP design](PROVIDER_HTTP_DESIGN.md) in the existing application image.

## Validation sequence

Use focused owner/policy/caller tests first, then freeze the final code and run
one complete fast gate. Build the existing walkthrough with a fresh disposable
BuildKit builder, `--pull --no-cache`, and load its immutable image. Compare
packaged server/shared/client bytes, package graph, OS packages and runtime pins
against the preceding image and local source/build before deployment.

Preserve the existing administrator, all five bind mounts, read-only root and
loopback port 47956. Use existing automatic database preparation and maintenance;
no manual schema refresh and no second deployed app. Do not stop unrelated busy
containers to make measurements pass.

## Guarded native evidence

`test/native/provider-http.test.js` runs explicitly in a disposable 3 GiB Linux
container using the actual packaged Node HTTPS stack, isolated PostgreSQL and
public test certificates. Its request hook redirects only the test connection
to loopback; original provider hostname, Host/SNI and normal certificate/name
verification remain. Public-address DNS, a test CA and trusted wrong-name control
are fixture controls. They do not contact Spotify/Google or establish live
account acceptance.

Cover normal identity/gzip/deflate/Brotli success, exact bounds, malformed and
oversized responses, truncated streams, header limits, redirect trap, sanitized
HTTP classification, header/body/trickle deadlines and caller cancellation.
Observe actual request/socket/response closure. Hold a real issued DNS callback
after abort to prove cross-provider admission and shutdown remain owned.

Mounted Spotify/YouTube callbacks and refreshes must survive controlled provider
timeouts without token/audit publication and then pass an explicit controlled
retry. Google revocation must start after committed local clear and retire when
its body stalls. Default API-key/client-credentials callers must use the shared
owner. Test flags for those observations are separate from unit promises.

Re-run the existing OAuth, Plex owner-link, Plex HTTP, Plex callback, automatic
retention and linked-login entries because app composition and the shared HTTPS
core changed. Both controlled Chromium OAuth navigation flows run against the
final image. Those fetch-controlled flows establish cookie/publication behavior;
only the new native fixture establishes default provider transport behavior.
The older provider HTTPS cohort explicitly exercises the retained fetch seam
and Apple Music, including proxy controls.

## Evidence and cleanup

Require immutable final-image runs without candidate overlays. Every disposable
container/network, temporary password file, builder and bind-write probe must
retire with absence/removal verification. Own test resources before fixture
cleanup; destroying fixtures first must not mask a missing transport drain.

Retain unrelated native memory/media/artwork proof only after exact packaged
runtime/source comparison. This change does not certify a whole-container memory
minimum or make fresh claims about unchanged media/SQL matrices. Human screen
reader and physical-device checks remain deferred. No product UI changed.

The [Docker outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md) records the executed
source/image hashes, checks, retained evidence and cleanup. Private raw evidence
lives under `.tmp/provider-http-2026-10-27/` and is not committed.
