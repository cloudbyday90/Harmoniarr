# Official practices for root-authority writer coordination

Consulted October 13, 2026 via MCP search, official version navigation and
GitHub repository metadata. The links below were discovered and opened through
those services. PostgreSQL 18 is the consulted documentation series; native
evidence records the actual server separately. No runtime/dependency upgrade.

| Source / status | Applicable practice | Implementation and proof |
| --- | --- | --- |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), vendor documentation | Advisory coordination requires participation; transaction locks release at transaction end. Consistent order reduces deadlocks | Reuse the existing projection key; database statement admission precedes root tuple mutation; observe real waits and commit/rollback release |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html), vendor documentation | Read Committed takes a new statement snapshot; waiting on admission alone does not refresh an earlier joined read | Acquire authority in one statement, then read current roots in a later statement. Prove a queued publisher observes a previously committed disable |
| [PostgreSQL 18 CREATE FUNCTION](https://www.postgresql.org/docs/18/sql-createfunction.html), vendor page reached through version navigation | Security invoker uses caller privileges; explicit trusted resolution avoids writable search-path dependence | Fixed pg_catalog calls and search path, no SECURITY DEFINER or privilege grants. Preserve function literal content in schema comparison |
| [PostgreSQL 18 CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html), vendor SQL documentation | Statement triggers execute even with no matching rows; UPDATE OF follows targeted columns. Statement conditions cannot inspect selected row values | Protect relevant user columns and all settings DML, including missing-row insertion. Routine login-only UPDATE remains outside admission |
| [PostgreSQL 18 trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html), vendor documentation | Triggers execute in the statement's transaction; per-statement functions return NULL | Fixed security-invoker function joins writer transaction lifetime; NULL does not suppress DML. Required-event rollback remains atomic |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer guidance | All transaction statements use the same client | Compatible explicit table lock refuses autocommit; admission and all Wanted work remain on the owned queryable. Independent observation avoids a third application checkout |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Current object authority and deny-by-default behavior belong at the owning boundary | Earlier committed disable/root changes refuse receipt availability; later writers wait for admitted publication. Keep every current read and both hashes |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data and prevent observation failure from owning domain outcomes | Retain fixed private diagnostics; no root/path/SQL/identity logging. Preserve original Error/null, drain holders and writers |
| [W3C High Resolution Time 3](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Monotonic durations distinguish elapsed work from wall-clock adjustments | Native/gate elapsed times are qualified evidence, not a W3C Recommendation, conformance claim or proof of faster application work |

Our design inference is that before-statement participation on the existing
lock is preferable to adding a row-level root trigger: the latter could wait
for projection authority while already holding a tuple lock required by a
publisher. A statement trigger sacrifices settings-key selectivity for clear
admission order and missing-row coverage. This is an application tradeoff, not
a standard's mandate for this exact key or lock frequency.

Authorization revocation admitted after publication starts waits until that
transaction ends; it does not retroactively cancel the admitted operation.
Database coordination also cannot freeze host filesystem bytes. Preserve
fresh closing content checks and existing maintenance contracts. W3C browser
accessibility/HTTP practices remain in the maintained skill; no UI or HTTP
behavior changes or blanket compliance claim are part of this slice.

See [design/pros and cons](WANTED_ROOT_AUTHORITY_COORDINATION_DESIGN.md) and
[executed outcome](WANTED_ROOT_AUTHORITY_COORDINATION_OUTCOME.md).
