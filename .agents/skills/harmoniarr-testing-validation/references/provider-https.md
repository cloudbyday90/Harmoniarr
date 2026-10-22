# Provider HTTPS qualification

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

This fixture covers the shared JSON clients, Last.fm and MusicBrainz. It does not cover other metadata/slskd/Plex/push clients,
live public DNS, remote providers, proxy authentication, all TLS variants or full
application SSRF resistance. See the [design](../../../../docs/PROVIDER_HTTPS_DESIGN.md)
and [outcome](../../../../docs/PROVIDER_HTTPS_OUTCOME.md).
