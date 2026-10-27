# Atomic account password changes

Date: October 27, 2026. [Official research and tradeoffs](PASSWORD_CHANGE_RESEARCH_2026_10.md).
Scope: existing application and route, modular ESM, no additional service,
dependency, migration or release.

## Modules and preliminary work

`account-security-service.js` delegates password change to a dedicated
`password-change-service.js` factory. Other account-management commands retain
their existing behavior. `password-change-store.js` owns the explicit-column
credential lookup, account lock, credential CAS and session revocation SQL.
The route still requires an authenticated session and CSRF and sets replacement
cookies only after the service returns.

The service captures primitive session identity and selected audit metadata
before any await. A bounded auth lookup supplies only the account/credential
facts needed for this command. It captures immutable ID, password hash and
PostgreSQL textual credential epoch, preserving null and microseconds. Current
password verification, same-password refusal, new hash derivation/validation and
new root-session material preparation all happen outside the write transaction.
The existing minimum, 4096-byte full-input cap and versioned scrypt profile remain.

## Transaction owner

The existing security-write owner provides checkout/end-to-end deadlines, local
SQL/lock limits, actual transport retirement, READ COMMITTED and no retry after
COMMIT dispatch. An optional preliminary-read signal is never passed into
admitted security writes. The route keeps its existing request contract.

Within that owner:

1. Lock the account with FOR NO KEY UPDATE initially, avoiding a shared-lock
   upgrade. Reread enabled status, exact hash and full textual credential epoch
   after any wait. Changed credentials refuse without writes.
2. Lock the initiating family, then select its exact token ID, account, family
   and token hash FOR UPDATE. Require an active, unexpired, unreplaced token
   issued under the current password epoch. A session that rotated while KDF
   work was pending must retry. Forced-password-change accounts remain eligible.
3. Replace the credential conditionally against the accepted hash/epoch and
   enabled account, requiring one affected row. Set a fresh database clock
   password-change timestamp and clear `must_change_password`. Return only the
   public account projection.
4. Revoke all active prior account tokens with `password_changed` reason. Require
   at least one affected row and independently verify that no prior active token
   remains. The account write lock excludes participating issuers/replay owners;
   those owners take account eligibility before family/token locks.
5. Publish a root token in a new family through the borrowed-client publisher.
   Record the required `password_changed` audit, including only the revoked
   session count and selected metadata. Check initiating-token expiry again
   before returning to the COMMIT owner.

The credential, old-token revocations, new session and required audit commit or
roll back together. Current role/state comes from the locked update result,
not the earlier session projection. There is no second checkout or nested
issuance transaction. The shared KDF service and SQL budgets remain unchanged.

## Races, publication and limits

Concurrent changes with the same accepted credential permit one winner. The
other sees a changed hash/epoch or invalid initiating token and refuses. A
rotation/replay that commits first can invalidate the initiating token; a change
that holds the account lock first prevents an old rotation from issuing a child
after account-wide revocation. Replaying an old family cannot revoke the new
root family. An old password login that verified before the change must pass its
own current-source guard and cannot publish using the stale verification.

Wrong/same passwords, invalid prepared hashes, changed sources and invalid
parents cannot publish replacement credentials. Required audit failure,
suppressed credential updates, partial revocation, final observed expiry and
deadline errors roll back all command writes. Commit acknowledgement loss can
leave a complete durable change without a returned session; no automatic retry
occurs. Explicit new-password login is the recovery path. A final expiry query
is a pre-COMMIT observation, not a guarantee about wall-clock expiry at network
delivery or the instant COMMIT completes.

No schema change is needed. The baseline reader understands every produced
hash; reverting the implementation would restore the previous non-atomic flow.
Other account-management revocations, provider sign-in/bootstrap/claim and
recovery commands remain separate ownership work. Their behavior is not certified
by this command's tests. Existing password/failure-counter policy is unchanged.

## Validation

Focused service/store tests cover immutable inputs, source and parent fences,
no-write refusals, revocation checks and required failures. Guarded native
PostgreSQL tests exercise actual current/null epochs, forced-change state,
checkout exhaustion, suppression triggers, real account waits, concurrent change,
rotation/replay/login races, CSRF, rollback, final expiry and controlled lost
COMMIT acknowledgement. A held backend verifies actual timeout retirement.
Run one full fast gate and immutable-image qualification with existing auth
regressions. [Outcome](PASSWORD_CHANGE_OUTCOME.md) records executed evidence;
[Docker design](LOCAL_DOCKER_PASSWORD_CHANGE_DESIGN.md) owns deployment checks.
