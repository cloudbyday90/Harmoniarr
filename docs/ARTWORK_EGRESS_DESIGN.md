# Artwork connection-time destination enforcement

Decision: October 22, 2026. Follows [image containment](ARTWORK_IMAGE_DOWNLOAD_OUTCOME.md).

Extract the existing Web Push ordinary-public-address policy and cancellable DNS
resolver into small network ESM modules. Preserve Push's public names, diagnostics,
first-address selection and timeout through compatibility adapters. Artwork needs
the entire validated snapshot for controlled dual-stack connection fallback.

Resolve both A and AAAA for every image hop/CAA retry using an owned cancellable
resolver. Any private, reserved, malformed, transition or wrong-family answer
blocks the whole destination. Bound total answers to 64, freeze them, and never
perform an OS lookup after validation. DNS and TLS share the existing image-chain
deadline. Cancellation prevents late DNS results from creating a socket.

Replace only the artwork downloader's default fetch with a narrow Node HTTPS GET
adapter. Use a new non-pooling agent per hop, a fixed-snapshot lookup callback and
Node's automatic family selection over approved addresses only. Preserve the
original URL hostname for Host, SNI and certificate verification. Revalidate
injected resolver results at the transport boundary. Keep header/byte limits,
manual CAA redirect policy, body cancellation and Sharp publication ownership.

This transport supports direct egress only. If HTTP_PROXY, HTTPS_PROXY or ALL_PROXY
is configured (either case), refuse before DNS or socket admission even if NO_PROXY
is present. Never silently bypass an operator's proxy. An owned agent prevents
global proxy/dispatcher changes from overriding the pin. Supporting a proxy later
requires separate destination-pin and routing proof; no proxy URL/credential may
enter diagnostics. Existing JSON clients retain their separate transport behavior.

The existing native image fixture will use an explicit test-only request adapter:
inspect the production pin/options, then map the vetted synthetic destination to
its owned loopback TLS listener. Keep original Host/SNI and default verification;
trust remains child-scoped. This establishes real TLS/stream/fallback behavior with
controlled routing, not live public DNS or public Internet reachability. Prove
private/mixed answer refusal before any request, cancelled DNS, rebinding between
hops/retries, fallback snapshot immutability, proxy non-contact, mismatched identity
and missing-CA refusal separately. No production origin or verifier exception.

See [official research and tradeoffs](ARTWORK_EGRESS_RESEARCH.md) and
[outcome](ARTWORK_EGRESS_OUTCOME.md). No release or dependency change is planned.
