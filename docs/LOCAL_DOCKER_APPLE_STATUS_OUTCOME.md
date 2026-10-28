# Apple local status Docker qualification outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_APPLE_STATUS_DESIGN.md),
[implementation outcome](APPLE_STATUS_OUTCOME.md) and
[official research/tradeoffs](APPLE_STATUS_RESEARCH_2026_10.md).

## Frozen source and packaged parity

Frozen source: 3,797 files,
`2c5bf3656ad1cfc8ced7ba6cd57ce1137ef8c75a9436f2cf5a363f123cd91fc2`.
Five code/test files were fixed before the final fourteen-stage gate. It passed
6,402 server, 4,504 client and 703 script/policy tests: 11,609 total, with no
failures, skips or cancellations. Lint, ESM, copyright, migration/snapshot/anchor,
image/compose checks, test hygiene and build passed. Production dependency audit
found zero vulnerabilities.

Fresh pull/no-cache BuildKit image:
`sha256:a015c8da22fc16d6a5a4cd578c25df3bad95ae23b2f2c612b2dbe2319bfb5634`.
Against the [preceding credentials image](LOCAL_DOCKER_APPLE_CREDENTIALS_OUTCOME.md),
exact inventories found only the status service and new signing-status policy
changed in packaged server code. All other server bytes, client/shared bytes,
110 npm package records, 151 OS package records, the Node binary and root package
metadata are unchanged. Counts are 1,055 server, 156 client and 13 shared files.
Client/shared match local build/source. Runtime remains Node 24.22.1, npm 12.0.2,
OpenSSL 3.5.9 and bundled Undici 7.30.1. The fresh builder was removed and absence
checked.

The existing read-only UID-1000 walkthrough is healthy at loopback port 47956.
The administrator and all five inspected bind sources, including the actual
downloads override, were preserved. Readiness passed; bootstrap helper and
temporary password file retired. Startup applied zero migrations and verified
115 applied, zero pending. No manual schema refresh or new deployed app is needed.

## Executed native checks

The fresh guarded status entry passed all 18 scenario groups on this immutable
image without source overlays, skips or cancellations. Its disposable container
used 3 GiB equal memory/swap, two CPUs, 256 PIDs, read-only UID-1000, no external
network/published ports and PostgreSQL/media tmpfs. Exact removal and absence
were verified. The successful overlay preflight is separate evidence, not the
final-image proof.

The actual application route, session middleware, settings reader, encrypted
credential owner and native PostgreSQL establish:

- Anonymous and currently disabled sessions receive authenticated-access refusal.
  The currently allowed requester role can read provider status and cannot read
  the administrator system overview.
- Missing and partial credentials are incomplete. A valid environment key plus
  valid IDs is locally valid. Nonempty malformed, RSA, P-384, public and oversized
  stored keys remain configured by presence but locally invalid, taking precedence
  over a valid environment key.
- A valid stored key recovers. Invalid legacy ID plus a missing ID reports invalid
  with distinct check states. Rotation is reread, and clearing a stored key uses
  existing environment fallback.
- Corrupt ciphertext returns a bounded 500 status-unavailable error without raw
  input or parser detail, rather than a missing/invalid credential summary or
  silent fallback. Restoring ciphertext permits a valid read again.
- The administrator system overview carries the same local status projection.
  Its unrelated dependency-health probes are controlled in the fixture; this is
  not live dependency-health qualification.
- Each successful or failed GET preserves exact settings, encrypted-secret and
  settings-audit projections, includes no-store and discloses no IDs, PEM or native
  parser details. The application's injected shared provider HTTP owner records
  zero calls across the entry.

These are local representation/key-suitability checks. No token is signed, remote
provider contacted, clock certified or Apple ownership/key-ID correspondence/
capability/revocation acceptance established. The API reads do not create an
atomic cross-store snapshot. Known database connection failure mapping is covered
by focused tests; native corruption supplies the actual storage-failure control.

## Walkthrough, retained evidence and limits

Live Chromium confirmed existing administrator login, one automatic no-store
schema diagnostics request, 164 current anchors, preserved focus and mobile
no-overflow. Desktop/mobile screenshots were reviewed. Packaged entrypoint bytes
and mode match source and the preceding image. The existing data-bind probe passed
private directory creation/sync, exclusive publication/collision and cleanup checks
and removed its owned files.

Previous Apple signing/HTTPS/save and Spotify/YouTube/OAuth/Plex/password/session/
KDF/media/artwork qualifications are retained after exact source/test/package/
runtime comparison. Their relevant owners and native dependencies did not change;
those matrices were not all rerun. Current native evidence qualifies status reads,
authorization and encrypted storage access. The prior unexplained linked-login
failure remains separate in the [provider HTTP outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md),
without diagnosis or repair here. No deployment memory minimum, live Apple,
manual AT or physical-device acceptance is inferred.

An initial focused lint run found a shadowed native fixture parameter; the
correction preceded native execution and source freeze. That lint record is
retained. Both the first native preflight and final immutable entry passed;
no failed invocation is counted as a pass.

GitHub MCP found zero open PRs initially and in the final check, so PR application,
stale Dependabot cleanup and rebase were inapplicable. No release workflow, tag,
registry publication, PR merge or separate application branch was used. Private
records in `.tmp/apple-status-2026-10-28/` include frozen manifests, gate logs,
exact inventories, preflight/final native results and retirement, reviewed
screenshots, bind/entrypoint probes, PR checks and final commit/push verification.
Next show saved local status in Settings, as described in the
[implementation outcome](APPLE_STATUS_OUTCOME.md).
