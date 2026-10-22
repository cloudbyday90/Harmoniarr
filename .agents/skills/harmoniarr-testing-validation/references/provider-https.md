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
the cap to MusicBrainz's larger, operation-dependent payloads.

This fixture covers the shared JSON clients and Last.fm; other metadata/slskd/Plex/push clients,
live public DNS, remote providers, proxy authentication, all TLS variants or full
application SSRF resistance. See the [design](../../../../docs/PROVIDER_HTTPS_DESIGN.md)
and [outcome](../../../../docs/PROVIDER_HTTPS_OUTCOME.md).
