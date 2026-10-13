# Wanted root-authority writer coordination

October 13, 2026. Baseline: `86c3915` on main.

## Decision

Join root-input mutations to the existing transaction-scoped
`harmoniarr.library-request-projection` lock. Wanted already holds this lock
before its initial projection through required source events and commit/rollback.
Database BEFORE STATEMENT triggers acquire the same lock before relevant DML
takes tuple locks. User/root writers that commit first are visible to the
publisher's subsequent Read Committed projection. Writers admitted later wait
until that publication transaction ends. Preserve every root read and both full
hashes in this round; coordinate writers before changing observation frequency.

Add a narrow ESM root-authority admission store that checks an active transaction
with a compatible `LOCK TABLE ... IN ACCESS SHARE MODE` statement, then acquires
the existing projection lock. Borrowed autocommit must refuse before projection
work; no separate checkout or new lock namespace. Worker run/lease ordering stays
ahead of existing projection admission.

## Writer inventory and database boundary

`app-user-service.js:updateAppUser` writes disabled/private-root fields;
administrator recovery also writes disabled state. User creation exists in auth,
administration and Plex provisioning. Ordinary identity/profile/password updates
do not change the receipt root contract. `settings.js:persistSettings` performs
upserts for the settings service and fixtures; direct setting delete/rename or
missing-row insertion can change music-root default/null semantics too.

Protect app_users INSERT, DELETE and UPDATE targeting id, is_disabled or
managed_library_relative_root. Protect all app_settings INSERT/UPDATE/DELETE at
statement admission: a statement trigger cannot safely decide affected keys
before its rows are selected, and a conditional row trigger would acquire the
projection lock after tuple locks. This deliberately serializes unrelated
settings writes too. Keep login/password-only user updates independent.

Use a fixed schema-qualified, security-invoker trigger function with pg_catalog
search path. No dynamic SQL, grants or elevated privileges. Required triggers
must survive snapshot bootstrap; inspect enabled state, timing/event/column
definition and function definition as critical schema anchors. Disabled or
changed anchors must refuse validation.

## Limits and alternatives

| Option | Pros | Cons / decision |
| --- | --- | --- |
| BEFORE STATEMENT database admission on existing lock | Covers canonical and ordinary direct DML; handles absent settings; avoids a new lock order | Global settings/user-root writer contention during file work; adopt narrowly |
| Only service-level locks | Smaller schema change; can select music setting precisely | Misses direct/bulk/recovery writers; insufficient for reducing authority reads |
| Conditional row triggers | Narrower setting contention | Tuple-before-projection inversion; reject |
| Whole-table SHARE locks | Implicitly covers all DML | Blocks routine login and unrelated updates; reject |
| Repeatable Read or root cache | Stable/fewer reads | Hides later committed authority changes; reject as an authorization shortcut |

DDL, TRUNCATE, disabled triggers, replication-role bypass and transactions that
take conflicting tuple locks before root-input DML are privileged maintenance
outside this admission contract. Keep existing maintenance pauses and consistent
application lock ordering. The lock neither freezes host files nor immediately
cancels already admitted work; later mutations wait rather than retroactively
changing that publication. No universal security or performance claim.

## Proof and recommendation stack

Prove actual production Wanted publication holds the lock after its final source
check and blocks current-owner/root writers until commit. Observe PostgreSQL
blocking on an independent owned observer without a third pool checkout. Cover
missing/JSON-null setting, owner disable/root change, writer-before-publisher
wait/snapshot, commit and rollback release, unrelated login progress, migration
and snapshot-installed triggers, autocommit refusal and required-event rollback.
Drain all holders/publishers/writers before fixture disposal; retain Error/null.

Recommended stack: database writer admission → active owned transaction → fresh
Read Committed roots → bounded exact receipt capture → opening/closing full hashes
→ source comparison → publication and required-event transaction. After proof,
design bounded same-owner/requirement opening/closing root reads with fresh
per-invocation state. Do not introduce cross-guard or cross-owner root reuse.

See [research](WANTED_ROOT_AUTHORITY_COORDINATION_RESEARCH_2026_10.md) and
[outcome](WANTED_ROOT_AUTHORITY_COORDINATION_OUTCOME.md).
