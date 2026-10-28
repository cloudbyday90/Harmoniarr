# Apple Music signing outcome

October 28, 2026. Implements the next item from [Apple HTTP](APPLE_HTTP_OUTCOME.md).
See [official research, pros/cons and stack](APPLE_SIGNING_RESEARCH_2026_10.md),
[design](APPLE_SIGNING_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_APPLE_SIGNING_OUTCOME.md).

## Delivered

The signer now admits only a private native EC/prime256v1 key, accepting bounded
inline PEM strings/Buffers or private KeyObjects. RSA, P-384, secp256k1, Ed25519,
public/symmetric keys, malformed/oversized input and URL/loader descriptors fail
before provider dispatch. Serialized material caps at 16 KiB; issuer/key values
are bounded nonempty strings. Exact Apple identifier shape/account ownership is
not inferred from those checks.

A small ESM policy module owns admission and time constants; the existing service
owns fixed SHA-256/P1363 signing and its per-client cache. Native key material and
identifier values are captured before asynchronous use. The public helper keeps
its token/expiresAt result and client re-export. All failure paths now use a
bounded apple_music_misconfigured error without key text, tokens or native causes.

New tokens have exactly 3,600 seconds between iat and exp and renew with 300
seconds remaining. Reuse refuses observed backward time or issuance ahead of the
clock. Invalid/unsafe clocks and renewal failures clear the old cache rather
than returning it. No network refresh, persistent token row or scheduled job is
introduced. Catalogue paths, shared native HTTP admission/shutdown, scopes,
credential storage and required authorization boundaries remain unchanged.

## Evidence and tradeoffs

The baseline probe generated signatures labeled ES256 from RSA (256 bytes),
P-384 (96 bytes) and secp256k1 (64 bytes), all with the preceding 180-day lifetime.
This demonstrates algorithm/key mismatch in the local signer, not an Apple
authentication bypass. Length alone could not distinguish secp256k1 from P-256.

Focused tests cryptographically verify four admitted input forms, reject twelve
key/input forms at both public helper and actual client before network dispatch,
check input mutation, bounded identifiers and cache/clock failure/recovery edges.
The final frozen fourteen-stage gate passed 6,369 server, 4,504 client and 703
script/policy tests: 11,576 total, no failures/skips/cancellations. Lint, ESM,
copyright, schema/migration/anchor, compose/image checks, hygiene and build passed.
Production dependency audit found zero vulnerabilities.

The [Docker outcome](LOCAL_DOCKER_APPLE_SIGNING_OUTCOME.md) owns actual packaged
P-256/one-hour bearer verification, saved wrong-key refusal, valid recovery and
retained native transport controls. It also records exact runtime parity and live
walkthrough checks. This is not live Apple acceptance or a memory minimum.

Benefits are explicit protocol-compatible key admission, shorter bearer exposure,
bounded parsing and useful local cache reuse. Costs are earlier rejection of
misconfigured keys, more signing and dependence on a reasonably correct clock.
The one-hour/five-minute values are project policy, not Apple/W3C requirements.
Native OpenSSL owns ECDSA; no custom primitive or new dependency was added.

Previously issued 180-day tokens are not revoked at Apple by this change. A
compromised key still needs authorized provider-side revocation. Existing client
instances retain their captured key until replaced; newly resolved clients read
current saved credentials. Clock rollback handling does not synchronize clocks
or prove arbitrary skew tolerance. No UI, SQL/schema, application dependency or
project version changed, and no release or additional service was deployed. Manual screen-reader/device checks remain
deferred because this patch adds no UI.

The initial complete gate found a release-policy test hardcoding PR #59's old
Buildx SHA. The corrected test verifies matching full pins across build and
promotion. That failed gate is retained; the final passing gate is a distinct
frozen source. PR #59's local action/setup/build/post validation is recorded in
its separate [design](DEPENDABOT_BUILDX_DESIGN.md) and
[outcome](DEPENDABOT_BUILDX_OUTCOME.md). No PR merge or release dispatch occurred.
The prior unexplained linked-login failure remains separate; this change does
not diagnose or claim to repair it.

## Next recommended item

This item is now implemented in the [credential-save design](APPLE_CREDENTIALS_DESIGN.md)
and [outcome](APPLE_CREDENTIALS_OUTCOME.md). Existing runtime admission remains
the final defense for saved and environment keys.

Reuse this admission policy at the protected Apple credential-save boundary and
validate Team ID/key ID shape there. The current generic secret mutation accepts
nonempty strings, and status reports configured presence rather than key validity.
Preserve partial edits, explicit clear/replacement rules, encrypted storage,
current authorization and bounded sanitized validation errors. Runtime admission
must remain the final defense before dispatch, including environment fallback.
