# Recipient eligibility consistency design

Design date: September 12, 2026. Harmoniarr uses Node 24 LTS native ESM services, PostgreSQL 18, Express, and Vue. This follows the [transactional request lifecycle work](TRANSACTIONAL_REQUEST_LIFECYCLE_OUTCOME.md).

## Problem and decision

Transactional user reads locked `app_users`, but Plex refresh could independently update `app_user_plex_profiles`. A request could therefore commit using eligibility that had changed concurrently. Locking only an existing profile row also misses concurrent insertion when that row is absent. Request creation additionally performed recipient checks before entering its persistence transaction.

Use the existing user row as a shared coordination point. A small ESM store acquires ordered user-row locks on the supplied transaction client. Transactional readers take shared locks; every profile insertion, update, or deletion takes a conflicting writer lock before changing the account/profile. Batch writers and request-family creation acquire all existing target guards in stable identifier order before dependent work.

After acquiring the guard, execute the joined account/profile read as a separate SQL statement. Under READ COMMITTED this obtains a fresh snapshot after a lock wait, rather than retaining the profile snapshot from a query that started before the writer committed. Keep the guard until the surrounding transaction ends. Writer locks use `FOR NO KEY UPDATE` where appropriate to avoid unnecessarily conflicting with foreign-key key-share checks.

READ COMMITTED is a requirement of this protocol and the current supported PostgreSQL default. The owning transactions currently inherit that default. A customized REPEATABLE READ default does not provide the fresh-command snapshot guarantee and is outside this validation; do not change the deployment isolation default without updating the owning transaction boundaries and tests.

Recheck every selected request recipient inside the creation transaction, before any family row, audit, or planning intent is written. A target that becomes ineligible causes the selected family to fail atomically rather than silently changing its recipients. Preserve early UI-facing checks and existing eligibility policy; the guarded check establishes the commit boundary. Reassignment already has a transactional target check and inherits the improved reader.

Cover linked-account refresh/safe relink, directory import/refresh, conflict relink, and unlink. Reload current identity under the writer guard where a decision previously depended only on a pre-transaction account snapshot. Fetch Plex/network preview data before acquiring locks; never hold database locks over remote provider calls.

## Official research and tradeoffs

Official source URLs were discovered via search/MCP and opened September 12, 2026.

PostgreSQL READ COMMITTED gives each command a new snapshot, while a waiting locking command can encounter an updated target row with older joined data. This motivates lock-first/read-second. [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html). Application consistency requires a coherent locking protocol across participating writers. [Application-level consistency](https://www.postgresql.org/docs/18/applevel-consistency.html). Lock compatibility and consistent ordering guide shared readers and conflicting writers. [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

OWASP recommends validating authorization at execution and guarding against time-of-check/time-of-use gaps. Apply a protected eligibility check immediately before persistence; this does not require an additional user confirmation flow. [Authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html). Preserve existing native feedback and focus behavior when a stale operation fails. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing user-row guard, then fresh read | Covers present and absent profiles; uses existing transactions; explicit ownership | Every profile writer must participate; conflicting changes wait | Recommended |
| Lock profile rows only | Small change for existing profiles | Cannot lock an absent row and prevent later insertion | Insufficient |
| Combined joined read and account lock | One SQL round trip | Joined profile data may predate a lock wait | Replace for transactional reads |
| Serializable transactions everywhere | Broader anomaly detection | Requires retry policy and wider behavioral change | Disproportionate for this bounded race |
| Advisory locks | Can represent an absent profile | Adds a separate lock identity/protocol despite an existing parent row | Unnecessary |

## Validation and boundaries

Use real PostgreSQL tests in both orderings: reader holds eligibility stable until commit; writer commits first and the waiting reader sees new eligibility. Exercise actual profile refresh and missing-profile insertion, request creation/reassignment rollback, and multi-target creation. Retain existing authentication, CSRF, fresh-session, and private Activity tests. Run focused tests and full validation before commit.

No eligibility rule, public route, schema, or queue change is needed. A committed request is evaluated against locally stored eligibility at that commit boundary; this does not promise that Plex cannot revoke access afterward or that a remote preview is current forever. No new UI control, ARIA role, focus movement, or live-region behavior is introduced. See the separate [outcome](RECIPIENT_ELIGIBILITY_CONSISTENCY_OUTCOME.md) for measured results, PR disposition, and release recommendations.
