# Plex callback retention research and decision

Consulted October 27, 2026 through the search MCP service. This completes the
automatic-cleanup followup in the [callback outcome](PLEX_CALLBACK_OUTCOME.md).
Primary URLs were discovered through MCP search and opened, rather than inferred.
The deployed baseline is PostgreSQL 18.6 with Node 24.22.1 and pg 8.23.1.

## Official guidance and application

| Source and status | Relevant guidance | Application |
| --- | --- | --- |
| [PostgreSQL 18 DELETE](https://www.postgresql.org/docs/18/sql-delete.html), database documentation | Bounded selection can constrain deletion; DELETE itself has no LIMIT clause. Deletion cardinality describes actual effects. | Lock/select a limited batch, classify bounded envelopes, then delete only selected eligible IDs. Require exact deletion cardinality and a required aggregate audit in the same transaction. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html), database documentation | SKIP LOCKED avoids waiting for occupied rows, but gives an inconsistent view and does not bypass table locks. | Use it only for opportunistic retention. Revisit skipped rows on later sweeps; do not treat a short batch as proof that all expired state is gone. Existing transaction/statement/lock deadlines still apply. |
| [PostgreSQL 18 advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html), database documentation | A transaction-level try-lock immediately succeeds or returns false; its ownership ends with the transaction. | Use one fixed retention claim without a session-scoped lock or waiting queue. It coordinates participating maintenance owners, not arbitrary secret writers. |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), informative security guidance | Expiry must be enforced server-side; client cookie expiry is not sufficient. | Retain callback-time database-clock expiry and single-use consumption. Cleanup limits retained data; it is not the authentication admission gate. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement on the Note track | Privacy protection includes limiting retention and unnecessary disclosure, beyond encryption alone. | Automatically dispose of obsolete pending login material. Audit only aggregate counts; do not export pending IDs, browser verifier/hash, PIN, profile or provider token. This is an engineering application, not a legal or complete standards-compliance claim. |

The 100-record batch, five-minute cadence and 24-hour legacy grace below are
project choices, not durations mandated by these sources. The W3C Statement is
privacy guidance, not a WCAG accessibility acceptance result. This backend change
adds no user action, form, notification or manual refresh requirement.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Delete on callback/read | Few moving parts | Misses abandoned flows; makes a read destructive or adds work to authentication | Decline |
| Purge every prefix match by row age or public metadata | Cheap classification | Can discard an unexpired payload or persistent integration material; cannot trust a metadata hint as expiry authority | Decline |
| One unbounded periodic DELETE/decryption loop | Simple eventual cleanup | Unbounded work, contention and memory; poor shutdown ownership | Decline |
| Dedicated table, expiry index and new scheduler | Direct indexed expiry; durable scan progress | Migration and additional infrastructure for a small existing namespace | Defer until measured backlog/plan evidence justifies it |
| Bounded encrypted-envelope retention inside existing maintenance | Preserves active flows and application topology; atomic aggregate audit; known transaction/drain owner | More bounded SQL/crypto; catch-up takes multiple ticks; unreadable/future formats remain | Implement |

## Recommended stack

1. Existing in-process interval runner and startup supervisor: one pass at startup
   and every five minutes, with actual transaction drain before re-admission or
   shutdown. No additional deployed service or manual endpoint.
2. Existing bounded write transaction and maintenance write guard. Stabilize the
   absence of a blocking maintenance lock before application row ownership; use a
   nonwaiting transaction advisory claim to avoid concurrent retention owners.
3. At most 100 canonical pending records, row-locked with SKIP LOCKED. Cap each
   returned ciphertext at 16 KiB. Keep a private keyset cursor so retained records
   do not permanently hide later candidates; reset on sweep completion/restart.
4. Decrypted version-1 expiry and database time determine ordinary eligibility.
   Legacy/malformed plaintext waits 24 hours after both creation and last update.
   Preserve unexpired, unknown-version, unreadable and oversized records. Preserve
   the persistent client identifier and all other namespaces/types.
5. Recheck each selected deletion threshold with database time; require exact
   cardinality and aggregate required audit atomically. Advance scan progress only
   after acknowledged commit. Do not automatically retry an uncertain commit.

This bounds returned/decrypted rows and transaction duration, not physical scan
pages or an exact maximum retention age under downtime, lock pressure or backlog.
Unknown formats and unreadable ciphertext require a separately reviewed policy.

**Next:** bound the existing Plex provider HTTP transport's elapsed time, response
body size and actual completion/drain. State expiry and SQL deadlines do not bound
external response resource use. Keep the existing endpoints and provider identity
verification, and qualify slow/oversized/truncated responses before publication.

See [implementation design](PLEX_RETENTION_DESIGN.md),
[implementation outcome](PLEX_RETENTION_OUTCOME.md),
[Docker design](LOCAL_DOCKER_PLEX_RETENTION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PLEX_RETENTION_OUTCOME.md).
