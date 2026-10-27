# Spotify and YouTube OAuth linking outcome

October 27, 2026. Implemented the next boundary from
[Plex owner linking](PLEX_OWNER_LINK_OUTCOME.md). See
[official research, alternatives and recommended stack](OAUTH_LINK_RESEARCH_2026_10.md),
[design](OAUTH_LINK_DESIGN.md) and [Docker outcome](LOCAL_DOCKER_OAUTH_LINK_OUTCOME.md).

## Delivered

Both providers now require browser-bound versioned state and the initiating
session's current administrator authority. Admission precedes code exchange and
is repeated at publication. Demotion, disablement, password-change requirements,
credential epoch changes, revocation, rotation and expiry refuse publication.
The callback uses a separate provider-scoped HttpOnly host-only Lax verifier;
ordinary refresh cookies remain Strict and need not accompany the cross-site GET.

State consumption, confirmed token replacement, provider revision and required
audit commit atomically. Clear confirms deletion and advances revision, invalidating
older flows. Exact token-record comparisons prevent a late refresh from undoing
clear/relink or overwriting another refresh. Refresh cancellation after local
writes rolls them back. Required audits and suppressed secret writes/deletes are
publication failures. Lost COMMIT acknowledgement is unavailable without retry.

The facade is smaller, with separate ESM policy, browser-binding, state-reader,
SQL-store, transaction-owner and command modules. Existing encryption, session
locks, bounded transactions, maintenance and audit are reused. Default reads are
bounded; provider work holds no owned database checkout. OAuth response reads cap
at 64 KiB while preserving smaller caller budgets and request admission hooks.
Secret reads/writes and public status metadata have explicit bounds.

Spotify scopes/S256/exact redirect and refresh-token preservation remain intact.
YouTube keeps its server secret, read-only scope, offline consent, incremental
authorization and refresh behavior. HTTPS/loopback redirect rules are enforced;
Spotify localhost is refused. No additional scope, dependency, schema, deployed
app or service was added. Existing maintenance automatically expires both OAuth
pending namespaces alongside Plex within one total bounded batch. No manual
schema refresh or cleanup is required.

## Evidence and compatibility

One frozen fourteen-stage gate passed: 6,331 server, 4,504 client and 703 script/
policy tests, with no failures/skips/cancellations, plus lint, ESM, copyright,
schema/migration/anchor/compose checks, hygiene and build. npm audit found zero
vulnerabilities. Eighty packaged PostgreSQL/HTTP scenarios cover both providers;
five existing affected entries and separate Chromium flows also pass. The Docker
outcome owns image parity, retirement and live walkthrough evidence.

Legacy unbound pending flows must restart. Rotating, expiring or revoking the
exact initiating session requires a new linking attempt; newly fingerprinted
tokens require compatible current client configuration. Legacy linked tokens
remain readable and gain a credentials fingerprint when refreshed.

Atomicity covers local PostgreSQL publication, not the provider. A consumed code
or rotated refresh token cannot be restored by database rollback. Restart linking
if remote credentials are no longer usable after a failed/uncertain publication.
Google revocation occurs only after local clear commits, is bounded and best
effort, and can affect a combined grant beyond one local token. In-flight remote
requests are not canceled by deleting a local token. Controlled retry/success
fixtures do not establish universal provider recovery or live account acceptance.
Human screen-reader/physical-device acceptance remains deferred.

GitHub MCP initial and final searches found no open PRs, including Dependabot PRs.
There was no random PR to implement locally or stale Dependabot PR to rebase/close.
No PR was merged. Work stays on main without a release or separate branch.

## Next recommended item

Harden and qualify Spotify/YouTube HTTP resource ownership through actual request,
body, cancellation and socket retirement, including token exchange/refresh and
Google revocation. `provider-json-request-service.js` bounds waiting and decoded
JSON, but default fetch cancellation and fire-and-forget reader cancellation do
not establish the native lifetime or global active-capacity guarantees now
qualified for Plex. Preserve this change's local authority/publication checks;
do not generalize Plex PIN contracts into OAuth or claim current native OAuth
transport proof from controlled responses.
