# Apple Music key admission and token lifetime design

October 28, 2026. Follows the [Apple HTTP outcome](APPLE_HTTP_OUTCOME.md) and
the separate [official research and tradeoffs](APPLE_SIGNING_RESEARCH_2026_10.md).

## Ownership

Add a narrow ESM policy module for signing credentials and time constants. The
existing developer-token service keeps fixed SHA-256/P1363 signing and one cache
per client. Its public helper remains re-exported by the catalogue client.
No new singleton, deployed service, database table or periodic refresh job is
needed: renewal is local signing on the next admitted catalogue request.

Accept inline PEM as a string/Buffer of at most 16 KiB, or a native KeyObject.
Require native private type, asymmetric EC type and named curve prime256v1.
Reject public/symmetric keys, RSA, P-384, secp256k1, malformed/encrypted material
without supported credentials, URL/STORE descriptors and arbitrary option objects.
Convert accepted PEM to an immutable native key before asynchronous use; changing
the caller's original Buffer must not change the accepted credential.

Keep issuer/key values as bounded nonempty strings, without changing them or
claiming to verify ownership in Apple's developer account. Strict account-ID
shape validation and external key revocation remain separate concerns. All
admission/signing/clock failures use the existing apple_music_misconfigured
contract with no raw key, token, parser details or native cause.

## Issuance and cache

Issue from one captured valid epoch-millisecond value. JWT iat/exp are integer
seconds; exp is exactly iat + 3,600 and signature encoding is 64-byte P1363. Renew
with 300 seconds remaining. Reuse only while the current clock is at or after
the issuance time and strictly before the renewal boundary. A backward jump
invalidates the cache; invalid/unsafe timestamps refuse issuance. A failed renewal
must not return an old cached bearer. Successful new tokens replace old cache
state only after signing completes.

Preserve the six catalogue methods, native HTTP destination/body/admission policy,
shared shutdown and saved-key resolver. A new resolver/client sees current saved
credentials; an existing client retains its captured key and bounded cache.
No saved data is rewritten. Previously issued tokens are not remotely revoked.

## Evidence

Reproduce baseline signatures from RSA/P-384/secp256k1 labeled ES256. Test real
P-256 signatures, admitted formats, refusal/privacy, mutable-input capture,
renewal edges, forward/backward/invalid clocks and actual client non-dispatch.
Extend the guarded Apple native entry to assert the new TTL on every TLS bearer,
refuse invalid saved key types before dispatch and recover with a valid key.
Use the existing image/runtime comparison and one frozen fast gate; retain
unrelated native transport/media/SQL proof after exact comparison.

The separate [Docker design](LOCAL_DOCKER_APPLE_SIGNING_DESIGN.md) and
[outcome](APPLE_SIGNING_OUTCOME.md) own qualification and compatibility evidence.
