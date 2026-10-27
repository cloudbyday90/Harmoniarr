# Preliminary authentication read research

Consulted October 27, 2026 through MCP search and official pages. The qualified
runtime uses PostgreSQL 18.6, Node 24.22.1 and pg 8.23.1.

| Official source and status | Applicable decision |
| --- | --- |
| [PostgreSQL 18 client defaults](https://www.postgresql.org/docs/18/runtime-config-client.html), vendor documentation | Statement, lock and transaction timeouts have different scopes. Use transaction-local SQL limits plus an owner deadline covering checkout and cleanup; do not change global defaults. |
| [node-postgres pool API](https://node-postgres.com/apis/pool), framework documentation | Checked-out clients must be released; pool acquisition timeout is distinct from query lifetime. Preserve the existing reviewed retirement owner rather than a bare Promise.race around pool.query. |
| [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), informative guidance | Infrastructure failure must not become invalid credentials or an empty bootstrap result. Return a fixed temporary error without SQL, credential or account details. Existing lockout status/timing behavior is outside this step. |
| [W3C accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum), informative WCAG 2.2 Understanding document | Preserve password-manager/paste-compatible login and existing feedback without adding a challenge. No new conformance claim follows from this backend change. |

## Alternatives and recommendation

| Option | Benefit | Limitation |
| --- | --- | --- |
| Pool connection timeout alone | Already available | Does not bound admitted SQL, rollback or late checkout retirement |
| Promise.race around each pool.query | Short caller wait | Native query/checkout can outlive refusal without an owner |
| Copy the session-read owner | Isolated code | Duplicates cancellation/rollback/transport guarantees |
| Reuse the reviewed read owner with a distinct error code (selected) | Read-only SQL limits, deadline, cancellation and actual drainage | Extra transaction round trips; same pool can refuse under contention |
| One new aggregate login transaction | One read budget | Couples existing bootstrap/validation seams and risks holding a client through hashing or writes |

Recommended stack: bounded pool admission; independently owned bootstrap and
credential reads; local read-only SQL limits; request-close cancellation only
for those preliminary reads; safe rollback/transport retirement; password
verification outside SQL; existing independent successful/failure write owners.
Each preliminary read has its own eight-second deadline. This is not a single
aggregate login deadline or a password-hashing admission policy.

Reuse immutable SQL facts without caching account authority. Keep the existing
current hash/epoch/account rechecks inside security writes. Bootstrap observation
does not authorize account creation by itself. Non-password account-claim lookups
remain separately scoped work.

See [design](AUTH_LOOKUP_DESIGN.md) and [outcome](AUTH_LOOKUP_OUTCOME.md).
