# Password login transaction design

October 27, 2026. Extract password login from the large auth module into an ESM
service and SQL store. Preserve the public login route and response contracts.

Capture normalized identifier, validated password, bounded request metadata and
the selected user ID/hash/exact textual credential epoch before verification.
Verify outside the transaction. The hash and timestamp are internal accepted
facts, never request-selectable authority or audit output.

Use the existing eight-second session-write owner (READ COMMITTED, one-second
lock, three-second statement and five-second transaction bounds). Acquire the
existing account guard in write mode before reading current state. Compare hash
and the full PostgreSQL timestamp text, including null and microsecond precision.
Recheck enabled and lockout state after the lock wait. Keep forced-password-change
login supported and project current role/flags from the locked row.

Reset login counters/update last login, issue a fresh root family and record the
required login_succeeded audit on that same client. Reuse a narrow owned-root
publication helper for generic issuance and password login; never nest transaction
owners. Account precedes family locks. Return credentials only after confirmed
commit. Audit failure rolls back all three writes; uncertain COMMIT refuses cookie
publication and is not retried automatically. The existing transaction owner
retains actual transport retirement responsibilities.

Native qualification must exercise changed hash/epoch (including submillisecond
and null epochs), actual account writer waits, changed enabled/lockout/role state,
concurrent successful logins, audit rollback/timeout, held transaction invisibility,
commit uncertainty and HTTP cookie refusal. Retain rotation/replay contracts on
the same packaged runtime. No schema artifact, UI or new service container is
required.

See [official research and tradeoffs](PASSWORD_LOGIN_RESEARCH_2026_10.md) and
[outcome](PASSWORD_LOGIN_OUTCOME.md).
