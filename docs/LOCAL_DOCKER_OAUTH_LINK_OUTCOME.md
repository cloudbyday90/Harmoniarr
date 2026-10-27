# OAuth linking Docker qualification outcome

October 27, 2026. See [qualification design](LOCAL_DOCKER_OAUTH_LINK_DESIGN.md),
[implementation outcome](OAUTH_LINK_OUTCOME.md) and
[official research/tradeoffs](OAUTH_LINK_RESEARCH_2026_10.md).

## Frozen candidate and deployment

Source: 3,778 files,
`4f946093feb6e59df39f4aff930511f3b1ebd3ff9e447730ef13c488774553d4`.
Nineteen code/test/helper files were frozen before one fourteen-stage gate:
6,331 server + 4,504 client + 703 script/policy tests = 11,538 passes, with zero
failures/skips/cancellations. Lint, copyright, ESM, migration/snapshot/anchor,
image/compose, hygiene and build passed. npm audit reported zero vulnerabilities.

Fresh pull/no-cache buildx image:
`sha256:99153ea22c4c7eeab39812c76bf8461a04f0bf37ae2604ee20877b9ea4bdf38f`.
Against prior image
`sha256:cc894841a4c1d05555abf19a3e0117ae9e8e14f9e4798bebea2bfd90fc164224`,
exact comparison found only twelve intended server changes, including six new
modules. There are 1,045 server, 156 client and 13 shared files. Client/shared bytes
match the local build/source, and unrelated packaged server files match the prior
image. Runtime/package provenance remains Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9,
undici 7.30.1, PostgreSQL 18.6 and pg 8.23.1. All 110 npm and 151 OS package records
are unchanged. The fresh builder was removed.

The existing read-only UID-1000 walkthrough is healthy on loopback port 47956. Its
administrator and all five inspected bind sources, including the actual downloads
override, were preserved. Readiness/existing login succeeded, the bootstrap helper
retired and the temporary readiness password file was removed. Startup verified
115 applied migrations, zero pending, with no migration execution.

## Affected packaged checks

Six fresh guarded entries use the immutable implementation without overlays:
OAuth linking (80 scenarios), Plex owner linking (33), Plex HTTPS (19), sign-in
callback (19), retention (14) and linked login (23). Each passes its test without
skips/cancellations. Containers are read-only UID-1000, 3 GiB equal memory/swap,
two CPUs, 256 PIDs, no network/ports, with disposable database/media tmpfs and
read-only test/helper mounts. Exact removal/absence is checked after every entry.

The eighty OAuth cases cover both providers' browser and current authority before
exchange, post-provider actor/session changes, committed demotion after an actual
account-lock wait, competing callbacks, revision and exact state fences, client
configuration change, required start/completion/clear/refresh audit rollback,
suppressed token writes, final state/parent expiry, precommit invisibility,
maintenance blocking/insertion, pool/lock bounds, stale and competing refreshes,
cancellation after writes, automatic retention, real COMMIT with controlled lost
acknowledgement, and actual backend disappearance after timeout. Cross-provider
state/revision isolation is also checked. Per-operation checkout tracking asserts
zero owned clients during provider work.

These OAuth/SQL lanes use controlled provider responses. The repeated Plex HTTPS
entry separately supplies actual native TLS/DNS/socket evidence; it does not
establish Spotify/Google native transport behavior. Controlled retry cannot prove
that a remote provider accepts a previously consumed code or rotated refresh token.

## Browser, live walkthrough and retention of evidence

Each provider has a separate Chromium fixture on the same immutable image. Two
isolated contexts verify Secure host-only HttpOnly Lax cookies, cross-site return
without the Strict refresh cookie, legitimate success, other-browser refusal,
older-tab refusal and replay without session replacement. The fake provider never
receives the binding cookie. Actual default service readers also return null while
unlinked and return the fresh linked token without another exchange. The public
test certificate exception is confined to fixture browser contexts; production
TLS policy is unchanged. Both fixtures exit zero and their exact containers,
networks, contexts and host servers retire.

Live walkthrough Chromium verifies existing administrator login, one automatic
no-store schema diagnostics request, 164 current anchors, preserved focus and no
mobile horizontal overflow. Desktop/mobile screenshots are reviewed. Live provider
accounts, manual screen-reader/physical-device acceptance, remote atomicity and
exactly-once external token rotation are outside this evidence.

Unrelated password/KDF/session/media checks retain prior qualification after exact
source/test/runtime comparison. Their implementations, dependencies, schema,
transaction/encryption/session/maintenance infrastructure and packaged bytes are
unchanged. Changed routing, retention and provider wrappers are covered by the
repeated affected lanes. This is not a new memory-capacity qualification.

Private evidence resides under `.tmp/oauth-link-2026-10-27`: source/code hashes,
gate/audit logs, immutable inventories, native and browser measurements/retirement,
screenshots, final manifest and post-push verification. Three earlier native
preflight revisions are labeled separately (72, 78 and 80 scenarios); final image
qualification is distinct. A focused assertion initially retained the old Plex-only
audit summary; it was updated for the expanded provider retention scope before
the frozen gate. No failed check is counted as a pass.

GitHub MCP initial/final searches found no open or Dependabot PRs to apply, rebase
or close. No PR merge, release, separate branch or additional deployed service was
created. The next native provider-transport ownership item is detailed in the
implementation outcome.
