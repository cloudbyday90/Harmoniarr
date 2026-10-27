# Atomic linked-provider login

Date: October 27, 2026. [Official research and tradeoffs](LINKED_LOGIN_RESEARCH_2026_10.md).
Scope: existing Plex sign-in, ESM modules, no new provider, dependency, schema
artifact, release or additional application.

## Admission and modules

Plex still obtains the token and fetches its current user through the existing
provider client. Restricted-account refusal remains before local admission.
Provider requests happen outside the transaction; no remote HTTP call holds a
database checkout in the controlled fixture.

The adapter's inline full-row lookup is replaced by `readLinkedPlexLoginUser` in
`linked-login-service.js`. The existing bounded auth-read owner supplies checkout,
query/deadline and retirement behavior. `linked-login-store.js` selects only ID,
primary provider and subject, preserving UUID preference over numeric ID and
returning at most one candidate. `linked-login-policy.js` owns a two-subject,
256-code-unit-per-subject admission policy, deduplication and the allowlisted
server-side proof descriptor. No profile name or email grants a link.

The callback passes only the selected account ID, `plex` provider, matched exact
subject and request metadata to `loginLinkedUser`. The old user-ID-only helper
is replaced by a facade over the dedicated factory. It cannot admit an absent
provider/subject descriptor. This internal descriptor is produced by verified
server-side provider work; it is not accepted from the HTTP request body.

## Atomic local publication

The service captures primitive identity and selected audit metadata and prepares
session material before the write owner. The existing bounded security-write
owner supplies READ COMMITTED, local SQL/lock limits, actual transport retirement
and no retry after COMMIT dispatch.

The service locks the account with FOR NO KEY UPDATE initially and rereads its
enabled state and exact primary provider/subject after any wait. Removed or
changed links refuse before any writes. It never silently retargets a different
local account after relinking. Disabled accounts retain the existing unavailable
error. Current role and forced-password-change state come from the locked update.

`login-bookkeeping-store.js` holds the existing successful-login SQL, shared by
password and linked login. The extraction preserves its statements and row-count
requirement. Counter/lockout reset, database last-login timestamp, root session
and `plex_sign_in_succeeded` audit use one transaction client. Root publication
borrows the client and preserves account-before-family order. No nested issuance
transaction or second checkout is acquired.

The audit helper now offers an opt-in `required` cardinality check. Linked login
uses it and requires exactly one inserted row, so a suppressed audit insert
rolls back bookkeeping/session publication. Existing audit callers retain their
default behavior. The audit contains selected metadata and local user identity,
not provider subject, token, password hash or callback state. Only public account
fields are returned, and user/session last-login timestamps agree.

The application's Plex service factory is injectable through `createApp`, matching
the composition pattern used for other services. The production default remains
the existing factory; the option is internal construction input, not an HTTP or
environment-controlled provider override. Native tests can therefore exercise the
actual mounted callback route with the real client and controlled responses.

## Publication and limits

Independent valid logins serialize without shared-lock upgrades and can each
create their own root family. Local failure/suppressed required writes roll back
all login writes. Lost COMMIT acknowledgement may leave a complete durable login
without returned credentials; the service never automatically retries it.
The route sets cookies only after callback completion and retains its existing
303 success/error redirect behavior.

Callback-state reads and deletion are still outside this transaction. Concurrent
callbacks are not made single-use by this patch, and deletion failure after a
committed login can still prevent response delivery. State expiry during provider
work, atomic consumption and browser binding require a dedicated followup. The
local guard also does not certify remote token validity at the instant of commit,
eliminate provider aliases linked to different accounts, or provide a durable
link revision that detects unlink/relink ABA histories. Exact current link values
and enabled state are the admission boundary qualified here.

## Verification

Focused policy/store/service and Plex/route tests cover minimal lookup, fixed
audit type, immutable proof and metadata, current link refusal and required
failures. Native PostgreSQL tests use a real encrypted pending-state store and
real provider client with controlled response transport. They cover source drift,
actual account waits, concurrency, pool exhaustion, suppressed bookkeeping/audit,
rollback, held uncommitted writes, redirect/cookie behavior, controlled COMMIT
ack loss and actual timed-out backend retirement. No live Plex/TLS session is
claimed. The complete fast gate and affected auth cohorts must qualify the frozen
source. See [outcome](LINKED_LOGIN_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_LINKED_LOGIN_DESIGN.md).
