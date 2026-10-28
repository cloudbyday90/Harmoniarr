# Apple credential-save Docker qualification outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_APPLE_CREDENTIALS_DESIGN.md),
[implementation outcome](APPLE_CREDENTIALS_OUTCOME.md) and
[official research/tradeoffs](APPLE_CREDENTIALS_RESEARCH_2026_10.md).

## Frozen source and packaged parity

Frozen source: 3,794 files,
`91ce31a1074ba4b072394627bd12380456ce790ea14f3eaba2aa83020e2bb412`.
Seven code/test files were fixed before the final fourteen-stage gate. It passed
6,385 server, 4,504 client and 703 script/policy tests: 11,592 total, no failures,
skips or cancellations. Lint, ESM, copyright, migration/snapshot/anchor,
image/compose checks, test hygiene and build passed. Production dependency audit
found zero vulnerabilities.

Fresh pull/no-cache BuildKit image:
`sha256:66e31b92bd566257b81a132d175a74b553e452da5c72322203d25ee6e1b35c7c`.
Against the [preceding signing image](LOCAL_DOCKER_APPLE_SIGNING_OUTCOME.md), exact
inventories found four changed/new server files: the signing policy, credential
normalizer, provider credential owner and settings validator. All other server
bytes, all client/shared bytes, all 110 npm package records, all 151 OS package
records, the Node binary and root package metadata are unchanged. Counts are
1,054 server, 156 client and 13 shared files. Client/shared match local build/source.
Runtime remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and bundled Undici 7.30.1.
The fresh builder was removed and absence checked.

The existing read-only UID-1000 walkthrough is healthy at loopback port 47956.
The administrator and all five inspected bind sources, including the actual
downloads override, were preserved. Readiness passed; bootstrap helper and
temporary password file retired. Startup applied zero migrations and verified
115 applied, zero pending. No manual schema refresh or new deployed app is needed.

## Executed native checks

Two fresh guarded entries ran on the immutable image without source overlays:
11 credential-save scenario groups and 27 existing Apple HTTPS/signing scenarios.
Both entries passed without skips or cancellations. Each disposable container
used 3 GiB equal memory/swap, two CPUs, 256 PIDs, read-only UID-1000, no external
network or published ports, and PostgreSQL/media tmpfs. Exact removal and absence
were verified for final and preflight containers.

The save entry exercises the actual application route, middleware, settings
service, encrypted owner and native PostgreSQL. It proves:

- Anonymous, missing-CSRF, current requester role and forced-password-change
  refusals leave settings, provider secrets and settings audit events unchanged.
- Identifier-only staged setup and private-key-only replacement work. Encrypted
  material round-trips, saved keys precede environment fallback, ordinary settings
  have no private-key row, and responses/audit details contain no submitted PEM.
- Combined invalid-ID/key, wrong-curve, oversized and set-plus-clear requests
  preserve exact settings/secret/settings-audit projections, including another
  pending provider secret and ordinary setting.
- Blank replacement retains exact ciphertext/timestamp while an ID changes.
  Key-only rotation changes the resolved key; explicit clear deletes the stored
  secret and exposes existing environment fallback.
- An owned native trigger fails the secret insert after an ID update. The HTTP
  failure leaves the prior settings/secret/audit projection intact, demonstrating
  actual transaction rollback. The trigger/function are retired on success and
  the entire disposable database is removed with the fixture.
- A valid save succeeds after refusals and clear. Local representation checks
  are not live Apple key ownership or key-ID correspondence checks.

The unchanged Apple HTTPS entry verifies real P-256 signatures and one-hour
tokens, all six catalogue methods, default application collection access through
an encrypted saved key, invalid stored-key refusal before dispatch and valid-key
recovery. It retains matched/untrusted/wrong-name TLS, private-DNS/proxy refusal,
identity/gzip/deflate/Brotli budgets, malformed/oversized JSON, bounded HTTP errors,
redirect refusal, deadlines, cancellation and shared admission/shutdown ownership.
All 26 issued requests produced 26 request closes and 26 socket closes, with zero
redirect-trap calls. Fixture-local trust/routing preserves provider Host/SNI and
normal TLS verification; this does not contact Apple or qualify public DNS.

## Walkthrough, retained evidence and limits

Live Chromium confirmed existing administrator login, one automatic no-store
schema diagnostics request, 164 current anchors, preserved focus and mobile
no-overflow. Desktop/mobile screenshots were reviewed. Packaged entrypoint bytes
and mode match source and the preceding image. The data-bind probe passed private
directory creation/sync, exclusive publication/collision and cleanup checks and
removed its owned files.

The preceding Spotify/YouTube, OAuth/Plex/password/session/KDF/media/artwork
qualifications are retained after exact source/test/package/runtime comparison;
their relevant owners and native dependencies did not change. They were not all
rerun. New save evidence qualifies the actual current middleware and encryption
path; it does not replace the broader auth or OAuth matrices. The earlier
unexplained linked-login failure remains separate in the
[provider HTTP outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md), without a diagnosis
or repair claim here. No deployment memory minimum, live account, manual AT or
physical-device acceptance is established.

The first native preflight failed on an incorrect trailing-newline expectation
for the existing environment fallback. Its log and verified retirement are
retained. The corrected overlay preflight passed separately from the final
immutable-image entries. No failed invocation is counted as a pass.

GitHub MCP found no open PR on the initial and final checks, so no local PR
application, cleanup or rebase was applicable. No release workflow, tag, registry
publication, PR merge or separate application branch was used. Private evidence
under `.tmp/apple-credentials-2026-10-28/` includes manifests, gate logs, exact
image inventories, preflight/final native results and retirement, screenshots,
bind/entrypoint probes, PR checks and final commit/push verification. Next improve
the existing read-only Apple status projection as described in the
[implementation outcome](APPLE_CREDENTIALS_OUTCOME.md).
