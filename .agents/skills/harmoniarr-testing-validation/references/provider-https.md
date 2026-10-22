# Provider HTTPS qualification

For child-process image isolation, run artwork-worker-protocol/service server tests
with the existing ingestion and provider cohort. The explicit Linux
`test/native/artwork-worker.test.js` qualifies maximum bytes/pixels and real process
retirement; keep it outside the routine fast glob. Use the constrained profile in
[the worker outcome](../../../../docs/ARTWORK_WORKER_OUTCOME.md), then verify the
actual packaged ESM default and source/image identities. Parent-loader blocking
proves default work reaches another process. A native-active marker establishes
work before cancellation, not a reproduced libvips hang. Inspect kill, exit, stream
close and publication as separate events. See the standards
[worker workflow](../../harmoniarr-web-standards/references/native-image-workers.md).

Direct artwork ingestion also uses the shared image-processing owner. Keep the
weighted admission/file-reader tests with provider compatibility when it changes.
`test/native/artwork-file-reader.test.js` is explicit Linux FIFO/growing-handle
proof, outside the fast server glob. `artwork-ingestion-workload.js` compares real
decode/files/publication across immutable images; compare exact output projections
and retire its containers rather than treating sampled RSS as a memory ceiling.

For aggregate artwork admission, use artwork-fetch-admission policy/consumer tests
and artwork-admission-https.test.js. Hold actual final assignment while overlapping
batch/single work waits; prove only two downloads/rewrites and queued cancellation
before dispatch. The native journey covers seven images through three providers,
real Sharp/files and controlled publication sinks. It establishes lifecycle counts,
not a hard memory ceiling or live-provider throughput. See
[resource admission](../../harmoniarr-web-standards/references/resource-admission.md).

Use for the shared Spotify/YouTube/Apple Music request service or its native
transport contracts. Existing policy tests inject Response objects; they do not
establish TLS identity, redirect refusal, decompression or socket retirement.

Run `node --test test/server/provider-https.test.js` with the repository Node
baseline. Reuse `testing/server/provider-https-fixture.js`: its child uses bundled
fetch and documented environment proxy support, retaining provider URL/Host/SNI.
The proxy accepts explicit authorities but connects only to its own loopback TLS
listener. The public CA belongs only to that child's startup environment. Never
expand production origins, replace the verifier, install fixture trust globally,
or import a transitive transport package to make this fixture work.

Compare matched DNS/IP, mismatched identity and absent-CA cases separately. IP
fetches are runtime controls, not provider origin admission. Observe actual
requests/tunnels; an option assertion alone cannot prove redirect targets stay
uncontacted. Compare compressed and decoded lengths independently. For deadlines,
hold the next healthy response until stalled/trickling sockets actually close;
process exit or fixture destruction is too late to establish abort retirement.
The cancellation control kills only the owned child and awaits process/stdio
close before listener/socket retirement.

Keep raw URLs, credentials, parser input, arbitrary headers and body text out of
diagnostics. A malformed URL must use the same approved error projection as an
unapproved origin. Retain original candidate failures; distinguish corrected test
expectations from production defects. Follow normal focused-to-fast validation.

## Last.fm response adoption

For Last.fm, run `test/server/lastfm-https.test.js` with its own child consumer.
The same fixture now includes the default ws.audioscrobbler.com identity. Keep
one client-owned queue and its existing transport/HTTP retry policy. Adopt the
shared decoded-byte reader; successful malformed/oversized bodies are terminal
failures, not empty successes or additional retries. Cancel ignored HTTP bodies
before backoff, preserving the known HTTP result through cleanup errors. Caller
abort identity belongs to its internal owner; provider-originated text does not.
Use exact-ceiling and gated cancellation controls plus native compressed/body
deadline proof. Stubbed sleep in native retry checks establishes ordering/counts,
not real rate cadence. Qualify the related-artists consumer as well. See the
[Last.fm outcome](../../../../docs/LASTFM_RESPONSE_OUTCOME.md) before extending
the cap to another provider's operation-dependent payloads.

## MusicBrainz operation budgets

Use `test/server/musicbrainz-response.test.js` for exact per-operation decoded-byte
limits and the structured 3,000-track fixture, and `musicbrainz-https.test.js` for
native default-origin compression, deadlines and ignored-body socket retirement.
Preserve includes, count/offset metadata, short pages, one client queue, meaningful
User-Agent, minimum admission interval and 429/503 Retry-After health fields.
Do not apply another provider's cap blindly or enlarge its wrapper to accommodate
MusicBrainz. The shared streaming core permits 8 MB; the existing shared-provider
wrapper still refuses anything above 2 MB. Byte caps bound input, not total heap.

Body-invalid success is a terminal typed failure; prove the real catalogue/cache
path records degraded health rather than caching an empty success, and that the
HTTP route maps it to safe 502 feedback. Separate parser tests, consumer mapping
and actual native transport evidence. Synthetic records prove tested shapes and
sizes, not every live catalogue maximum. Keep failed candidate controls and
distinguish correcting a mock's call count or read-start gate from a runtime fix.
See [MusicBrainz design](../../../../docs/MUSICBRAINZ_RESPONSE_DESIGN.md) and
[outcome](../../../../docs/MUSICBRAINZ_RESPONSE_OUTCOME.md).

## Fanart.tv response ownership

Use `fanart-response.test.js` for exact decoded limits, awaited HTTP-body cleanup,
credential-resolver privacy and the actual artwork consumer. Use
`fanart-https.test.js` for default-origin Host/SNI, header-only synthetic keys,
redirect-target refusal, decompression and deadline-driven socket retirement.
Preserve 404-empty results and selection priority. A successful flat album fixture
is compatibility evidence, not proof of current v3.2 nested album selection.
Match provider schema/version and requested target before claiming live payload
support. Trace default application credential wiring separately: injected keys
prove the client transport, not delivery of saved keys through startup composition.
Use `fanart-wiring.test.js` and `fanart-wiring-https.test.js` for real credential
owner/module/client composition with controlled persistence. Assert stored-key
rotation/clear, exact nested album identity and no effects after refusal. The
native child uses the same real artwork consumer with controlled image and
assignment sinks; this does not prove PostgreSQL encryption or real image decode.
See the [wiring outcome](../../../../docs/FANART_WIRING_OUTCOME.md).
See [design](../../../../docs/FANART_RESPONSE_DESIGN.md) and
[outcome](../../../../docs/FANART_RESPONSE_OUTCOME.md).

Validate retry/timeout configuration before admission. Very long Retry-After
values must not overflow Node's timer and become early retries; qualify approved
deferred failure separately from ordinary date/seconds and backoff behavior.
JSON refusal must occur before image download/ingestion. This does not qualify
the subsequent image downloader's URL, redirect, byte or image-format policy.
For no-cache OS drift, keep the original artifact refusal and qualify the exact
new package separately. Node's bundled component version can remain unchanged
after a security backport; it is not the same binary as the OS shared library.
See the [Docker outcome](../../../../docs/LOCAL_DOCKER_FANART_RESPONSE_OUTCOME.md).

This JSON cohort covers the shared clients, Last.fm, MusicBrainz and Fanart.tv.
It does not qualify other metadata/slskd/Plex/push APIs,
live public DNS, remote providers, proxy authentication, all TLS variants or full
application SSRF resistance. See the [design](../../../../docs/PROVIDER_HTTPS_DESIGN.md)
and [outcome](../../../../docs/PROVIDER_HTTPS_OUTCOME.md).

## Artwork image transport and publication

Use `artwork-image-download.test.js` for per-provider origins, exact byte ceilings,
manual CAA redirect admission and cleanup ordering. Use `artwork-image-https.test.js`
for actual default-origin sockets, healthy-after-refusal gates and real Sharp
inspection/rewrite into a temporary directory. Its assignments/database are
controlled sinks, not PostgreSQL proof. The fixture adds only the reviewed image
authorities; child-scoped public trust and the default verifier remain intact.

Identity HTTP images have one streamed byte budget; compressed HTTP responses are
refused. Do not describe this as compressed-image decompression qualification.
Raster signature admission happens before Sharp; input-pixel ceilings and rewrite
remain separate from file-byte limits and aggregate process memory limits.
Observe every cleanup promise even when the deadline signal has already fired;
otherwise an aborted reader cancellation can reject without a handler. Failed
redirect cleanup must not admit another hop. Expected ECONNRESET from deliberate
abort is distinct from failed identity verification. Preserve failed native runs
and identify production fixes separately from corrected fixture expectations.
See [design](../../../../docs/ARTWORK_IMAGE_DOWNLOAD_DESIGN.md) and
[outcome](../../../../docs/ARTWORK_IMAGE_DOWNLOAD_OUTCOME.md).

## Artwork connection-time egress

Use `artwork-egress.test.js` for complete A/AAAA validation, immutable pinning,
proxy refusal, cancelled/late DNS and fresh redirect/retry resolution. Keep the
Push public-policy/resolver/transport checks when changing their extracted owner.
`artwork-egress-https.test.js` observes native fallback, TLS identity refusal,
proxy non-contact and rebinding refusal with a healthy-after-close gate.

The direct fixture inspects production lookup, Host/SNI, agent and verification
options before a test-only loopback reroute. Its public DNS answers are controlled;
do not claim public Internet or native IPv6 reachability. Read Node's completed
`autoSelectFamilyAttemptedAddresses` for fallback evidence: the first attempt may
precede the request's socket event listener. A missing event alone is not a lost
connection attempt. Keep earlier failing event-capture evidence.

Artwork fails closed when a proxy is configured, including NO_PROXY wildcard.
Do not silently bypass that condition for live checks or infer safe proxy support
from a CONNECT fixture. See [egress design](../../../../docs/ARTWORK_EGRESS_DESIGN.md)
and [outcome](../../../../docs/ARTWORK_EGRESS_OUTCOME.md).
