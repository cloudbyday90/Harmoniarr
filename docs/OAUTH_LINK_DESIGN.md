# Spotify and YouTube OAuth linking design

October 27, 2026. See [research/tradeoffs](OAUTH_LINK_RESEARCH_2026_10.md),
[outcome](OAUTH_LINK_OUTCOME.md) and [packaged qualification](LOCAL_DOCKER_OAUTH_LINK_DESIGN.md).

## Modules and protocol

The existing Spotify and YouTube wrappers retain their authorization/token URLs,
scopes, S256 PKCE and provider-specific parameters. The shared facade orchestrates
protocol work; separate policy, state-reader, SQL-store, transaction-owner and
command modules own local decisions. No new deployed app, service, dependency or
schema is introduced.

Start still requires a fresh administrator session and CSRF. It captures the
account ID, exact refresh-token/family IDs and one-way token hash. A separate
HttpOnly host-only Path=/ SameSite=Lax cookie per provider carries a 32-byte
browser verifier for ten minutes. Secure deployments use `__Host-` names; ordinary
session cookies stay Strict. Successful starts reuse a browser verifier across
tabs, renew its lifetime and expose only authorization URL, expiry, provider and
scopes. Start/callback responses use no-store and no-referrer.

Encrypted v1 pending envelopes contain provider/purpose, browser hash, authority,
verifier, exact redirect, credentials fingerprint, link revision and ten-minute
DB-clock expiry. State is canonical 24-byte base64url randomness. Legacy unbound
envelopes fail closed. Redirects require HTTPS or supported loopback HTTP, with no
userinfo, fragment or query; Spotify does not accept localhost. Provider dashboard
registration/validation remains required.

## Local publication

Short bounded transactions acquire the existing maintenance guard, account write
lock, session-family lock, exact session row and per-provider installation lock.
Current role, enabled/password-change state, credential epoch, revocation,
replacement and expiry are checked after lock waits. The initiating session is
rechecked at publication; no later session inherits that authorization.

Preparation initializes a persistent encrypted provider revision. Pending creation
rechecks the revision and client credentials and atomically records required start
audit. Callback admission verifies current authority, exact pending record,
revision, configuration and expiry before code exchange, then releases its
checkout. Provider calls run without an owned database checkout. Completion
rechecks those facts, consumes exactly the accepted state ID/name/ciphertext/full
timestamp revision, replaces the token, advances link revision and records
required audit in one transaction. State, token and parent expiry are checked
before commit. Success is returned after commit; acknowledgement loss is never
automatically retried.

Clear confirms token deletion, advances revision even when already unlinked and
commits required audit together. Older pending flows cannot undo clear or another
completed link. Only after local commit does YouTube attempt revocation of the
captured old access token, with a 15-second signal, redirect refusal and response
body cancellation. The private revocation token never reaches the public result.
Google's broader grant effects and in-flight remote operations are not a local
transaction guarantee.

Refresh captures a bounded exact token record before provider work. Under the same
provider lock it compares that record and current configuration, confirms token
replacement and commits required system audit. A stale refresh cannot overwrite
clear/relink or another refresh. Caller cancellation is checked throughout the
transaction and rolls back admitted writes. Omitted refresh token, scope and token
type retain prior values. New credentials fingerprints are checked before using
fresh tokens; legacy tokens without that field remain readable until refresh,
when they gain the current fingerprint.

Known client-ID and stored client-secret rows are held with share locks during
publication. Fingerprints pin client identity and token/refresh parameters, never
persisting a client secret in pending state. Environment secrets are process
configuration; inserting a new stored override for an absent credential row is
not fully serialized by these row locks. This is not a claim of coordination with
every settings writer or exactly-once remote token rotation.

## Bounds, maintenance and compatibility

Secret reads select at most two rows and 16 KiB ciphertext; ambiguous/oversized
records refuse. Writes cap plaintext at 12 KiB UTF-8 and must reread/decrypt to the
exact intended value. Public status metadata is bounded. Codes, verifier and token
fields are bounded; OAuth JSON response reads cap at 64 KiB, retaining any smaller
caller budget. Provider descriptions are not exposed.

The existing callback retention worker now includes canonical Spotify/YouTube
pending names within its same total 100-row batch, keyset cursor, maintenance
ownership, conservative legacy grace and required aggregate audit. Persistent
token/revision/client records are excluded. Its internal Plex-named interfaces and
historical `plex_callback_state_pruned` event type remain compatible; the event
summary now describes provider callbacks. Expiry enforcement does not wait for
maintenance, and no manual schema refresh is involved.

No new scope is requested. Existing linked tokens remain compatible; old pending
flows and invalidated sessions must restart. Database rollback cannot restore a
consumed provider code or remotely rotated/revoked grant. Reverting to an older
implementation must abandon live pending flows rather than downgrade their
authorization rules. Human screen-reader/device and live provider acceptance
remain separate from automated controlled fixtures.
