# Apple Music Docker qualification outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_APPLE_HTTP_DESIGN.md),
[implementation outcome](APPLE_HTTP_OUTCOME.md) and
[official research/tradeoffs](APPLE_HTTP_RESEARCH_2026_10.md).

## Source and packaged parity

Frozen source: 3,789 files,
`3ee7d90fa04eec960ad1b2ad6d986157cc2f6faef105d336d59225898bcf548c`.
Ten code/test/helper/workflow files and the deleted adapter were fixed before the
final fourteen-stage gate. It passed 6,347 server, 4,504 client and 703 script/
policy tests: 11,554 passes, no failures/skips/cancellations. Lint, ESM, copyright,
migration/snapshot/anchors, image/compose checks, hygiene and build passed.
Production dependency audit found zero vulnerabilities.

Fresh pull/no-cache BuildKit image:
`sha256:4a679fb0c760c0beefaf6db4d6d0b95efa60082bcd60e2c6a0b37b248e6bf431`.
Against preceding image
`sha256:3b91cd80b8761607886119342d0529f7597a4722757531814790934335c8ffff`,
exact inventory comparison verified five changed/new server files and one removed
legacy adapter. Other server bytes, all client/shared bytes, all 110 npm package
records, all 151 OS package records, the Node binary and root package metadata are
unchanged. Counts remain 1,052 server, 156 client and 13 shared files. Client/shared
match local build/source. Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9
and bundled Undici 7.30.1. The fresh builder was removed and absence checked.

The existing read-only UID-1000 walkthrough is healthy on loopback 47956. The
administrator and all five inspected bind sources, including actual downloads
override, were preserved. Readiness passed; the bootstrap helper and temporary
password file retired. Startup applied zero migrations and verified 115 applied,
zero pending. No manual schema refresh or new deployed app is required.

## Executed native and live checks

Two fresh guarded entries use that immutable image without candidate overlays:
22 Apple scenarios and 35 existing Spotify/YouTube HTTP scenarios. Each entry
passes without skips/cancellations. The containers use read-only UID-1000, 3 GiB
equal memory/swap, two CPUs, 256 PIDs, no external network or ports and disposable
database/media tmpfs. Exact removal/absence is verified after each invocation.

Apple's entry observes 25 request closes and 25 socket closes for 25 issued
requests, with zero redirect-trap calls. Actual matched TLS works; untrusted and
trusted wrong-name TLS refuse before HTTP. Private DNS and configured proxy
controls refuse dispatch. Held issued DNS retains the slot against both other
providers and holds shutdown until callback completion.

Identity/gzip/deflate/Brotli success, exact decoded boundary, compressed overflow,
malformed JSON, bounded HTTP 401/429 classification, Retry-After, header/body
deadlines, active caller cancellation and active shutdown are covered. The server
cryptographically verifies actual developer JWTs. The default application's
collection-access service resolves the real encrypted saved key and sends through
the shared native owner. The real resolver exercises all six catalogue methods
with one cached bearer. Invalid saved signing material causes no dispatch.

Fixture-only loopback routing and public trust preserve provider Host/SNI and
normal certificate/name verification. These cases do not contact Apple or qualify
public DNS, subscriber authorization or all real catalogue sizes. The older
eight-case bundled-fetch HTTPS cohort passes separately through explicit injection
for all three providers; its cancellation/proxy checks are distinct evidence.

Live Chromium confirms existing administrator login, one automatic no-store
schema diagnostics request, 164 current anchors, preserved focus and mobile
no-overflow. Desktop/mobile screenshots were reviewed. Packaged entrypoint identity
matches source. The existing data-bind probe passes directory creation/sync,
exclusive publication/collision and cleanup checks and removes its owned files.

The preceding OAuth/Plex/password/session/KDF/media/artwork qualifications are
retained after exact source/test/package/runtime review. Their owners, SQL,
schemas, encryption/transaction infrastructure and native dependencies did not
change. The prior unreproduced linked-login failure remains documented in the
[preceding Docker outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md); this patch
does not diagnose or fix it. No fresh whole-container memory minimum, live-account,
manual screen-reader or physical-device acceptance is claimed.

## Failed candidates and PR validation

An initial native fixture referenced a private resolver property that the provider
module does not expose. The corrected fixture uses its public default collection
service and the real resolver. Initial lint caught duplicate import/re-export and
an unused import; corrections preceded the final freeze. The failed preflight
and successful revised preflight remain labeled separately from final-image proof.
No failed invocation is counted as a pass.

Random Dependabot PR #60's ORAS action update was applied locally and its actual
bundle/default CLI passed checksum-verified installation and local OCI operations.
Its separate [outcome](DEPENDABOT_ORAS_OUTCOME.md) owns initial runner-fixture
failures, cleanup and compatibility limits. No release workflow or authenticated
registry publication was run. Work stays on main without a release/tag, PR merge
or separate application branch.

Private evidence under `.tmp/apple-http-2026-10-28/` includes frozen code/deletion
manifests, gate/audit logs, immutable image inventories, native results and exact
retirement, ORAS bundle/CLI records, screenshots, bind/entrypoint probes and final
commit/push verification. Next review P-256 key admission and token lifetime in
the extracted developer-token service.
