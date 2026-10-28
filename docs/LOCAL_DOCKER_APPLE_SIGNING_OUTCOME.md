# Apple signing Docker qualification outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_APPLE_SIGNING_DESIGN.md),
[implementation outcome](APPLE_SIGNING_OUTCOME.md) and
[official research and tradeoffs](APPLE_SIGNING_RESEARCH_2026_10.md).

## Frozen source and packaged parity

Frozen source: 3,791 files,
`e0151122e180898cd2e6180592ff5cbd4ccda62e90c4d1113a330ae8b5856d41`.
Seven code/test/workflow files were fixed before the final fourteen-stage gate.
It passed 6,369 server, 4,504 client and 703 script/policy tests: 11,576 total,
with no failures, skips or cancellations. Lint, ESM, copyright, migration/snapshot/
anchor, image/compose checks, hygiene and build passed. The production dependency
audit found zero vulnerabilities.

Fresh pull/no-cache BuildKit image:
`sha256:d7be7cc73f5e636f0fc6c6fd098188e07022b7d2a6b089b491144f5234ede214`.
Against the [preceding qualified image](LOCAL_DOCKER_APPLE_HTTP_OUTCOME.md),
exact inventories found only the developer-token service and new signing-policy
module changed in packaged server code. Other server bytes, all client/shared
bytes, all 110 npm package records, all 151 OS package records, the Node binary
and root package metadata are unchanged. Counts are 1,053 server, 156 client and
13 shared files. Client/shared match local build/source. Runtime remains Node
24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici 7.30.1. The fresh builder
was removed and absence checked.

The existing read-only UID-1000 walkthrough is healthy at loopback port 47956.
The administrator and all five inspected bind sources, including the actual
downloads override, were preserved. Readiness passed; the bootstrap helper and
temporary password file retired. Startup applied zero migrations and verified
115 applied, zero pending. No manual schema refresh or additional deployed app
is required.

## Native signing and transport

The guarded Apple entry passed all 27 scenarios on the immutable image, without
candidate overlays, skips or cancellations. Its disposable container used 3 GiB
equal memory/swap, two CPUs, 256 PIDs, read-only UID-1000, no external network or
published ports, and PostgreSQL/media tmpfs. Exact removal and absence were
verified. The successful overlay preflight is a separate record and is not the
final-image proof.

The TLS fixture cryptographically verified actual P-256 developer JWTs and
3,600-second lifetimes. The default application's collection-access service
resolved its encrypted saved key and used the shared native HTTP owner. The real
resolver exercised all six catalogue methods with one cached bearer. Malformed,
RSA, P-384, secp256k1 and public saved keys refused before network dispatch with
sanitized errors. Restoring a valid saved key and resolving a fresh client
recovered successfully.

The same entry retained identity/gzip/deflate/Brotli success, exact decoded-size
boundary, oversized/malformed bodies, redirect refusal, bounded 401/429 errors,
Retry-After, header/body deadlines, caller cancellation and active shutdown.
Matched TLS succeeded; untrusted and trusted wrong-name TLS refused before HTTP.
Private DNS and configured proxies refused dispatch. Held issued DNS retained
shared admission against both other providers and held shutdown until callback
completion. All 26 issued requests produced 26 request closes and 26 socket
closes; the redirect trap observed zero calls.

Fixture-only loopback routing and public test trust preserved provider Host/SNI
and normal TLS identity verification. This does not contact Apple or establish
live account/subscriber authorization, public DNS behavior or all catalogue sizes.
Deterministic focused tests own cache/clock boundaries and all four admitted key
formats; native system time was not changed.

## Retained behavior and limits

Live Chromium confirmed existing administrator login, one automatic no-store
schema diagnostics request, 164 current anchors, preserved focus and mobile
no-overflow. Desktop/mobile screenshots were reviewed. Packaged entrypoint bytes
and mode match the preceding image and source. The existing data-bind probe
passed private directory creation/sync, exclusive publication/collision and
cleanup checks and removed its owned files.

The preceding Spotify/YouTube, OAuth/Plex/password/session/KDF/media/artwork
qualifications are retained after exact source/test/package/runtime comparison.
Their owners, SQL, encryption/transaction infrastructure and native dependencies
did not change. They were not all rerun for this signer-only patch. The prior
unexplained linked-login failure remains separate in the
[provider HTTP outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md); this work does not
diagnose or claim to repair it. No whole-container memory minimum, manual
screen-reader or physical-device acceptance is claimed.

The initial full gate exposed a release-policy test hardcoding the old Buildx
pin. That failed gate is retained separately; only the later frozen passing gate
qualifies this image. PR #59's actual setup/build/post execution and cleanup are
recorded in the separate [Buildx outcome](DEPENDABOT_BUILDX_OUTCOME.md). No release
workflow, authenticated registry publication, tag or PR merge was performed.

Private evidence under `.tmp/apple-signing-2026-10-28/` includes frozen manifests,
both gate records, exact image inventories, native preflight/final results and
retirement, Buildx bundle/cleanup records, reviewed screenshots, bind/entrypoint
probes and final commit/push verification. The next item is protected Apple
credential-save validation, as detailed in the [implementation outcome](APPLE_SIGNING_OUTCOME.md).
