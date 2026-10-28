# Apple Music owned HTTP design

October 28, 2026. Extends the next item in the
[provider HTTP outcome](PROVIDER_HTTP_OUTCOME.md), using the separate
[research and tradeoffs](APPLE_HTTP_RESEARCH_2026_10.md).

## Boundaries

`createApp` already creates the provider HTTP owner and the provider module passes
it into the client resolver. Apple Music now receives that same owner, just as
Spotify and YouTube do. No new deployed app, network service or singleton is
needed. The common limit remains four total active requests, including caller
preparation and post-cancellation retirement; no new waiting queue is introduced.

`apple-music-developer-token-service.js` owns signing and its per-client cache.
`apple-music-client.js` retains configuration validation and the six catalogue
methods. Its existing named signing export is re-exported for compatibility.
The extracted implementation keeps 180-day validity, renewal 30 days before
expiry, ES256 header, issuer/key identifiers and IEEE-P1363 signature format.
Keys/tokens remain server-side. This extraction does not add stricter key-type,
identifier or clock policy; those are a separate next decision.

The provider JSON adapter now routes all three providers through the same owner.
The obsolete `provider-fetch-json-request-service.js` is removed. Explicit custom
fetch injection still selects the owned compatibility seam, awaiting fetch/body
cancellation promises; it does not certify native socket or encoded-byte limits.
The older HTTPS cohort explicitly injects this seam for Apple too.

## Transport and compatibility

Provider policy adds only `https://api.music.apple.com`, already used by the client.
Normal native certificate and hostname verification, original Host/SNI, complete
public DNS validation and fresh non-keepalive agents remain. Redirects, alternate
origins/userinfo/fragments/ports and configured upper/lowercase HTTP(S)/ALL_PROXY
are refused. NO_PROXY does not override that refusal. These proxy semantics are
a compatibility change for Apple Music.

The shared native owner preserves the default 15-second deadline and configured
1–60 second bounds. It accepts at most 2,000,000 wire bytes and decoded bytes,
subject to smaller caller limits; error bodies cap at 4,096. Single identity,
gzip, zlib-deflate or Brotli responses use the existing bounded reader. Strict
UTF-8/object JSON, trailing-data/unknown-layer refusal and safe HTTP status/
Retry-After classification apply. There are no automatic new retries.

Apple consumes the same slots as API/OAuth/revocation work for the other two
providers. Deadline/caller failure can return before retirement, but cannot
release a slot. Success waits for actual request/response/socket/codec and issued
DNS retirement. Uncertain retirement seals admission. Existing application
shutdown stops producers before aborting/draining this owner.

All six public methods retain current paths, storefronts, includes, limits and
offsets. The default collection-access service must resolve the encrypted saved
key, sign a bearer and use this shared native owner without injected credentials.
Invalid stored signing material must fail safely before dispatch. No SQL/schema,
UI, migration, dependency graph or release/version change is required.

See the separate [implementation outcome](APPLE_HTTP_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_APPLE_HTTP_DESIGN.md).
