# Prepared PostgreSQL test database design

October 10, 2026, America/New_York. Clean main baseline: b9f4473.
Separate [research](POSTGRES_TEST_TEMPLATES_RESEARCH_2026_10.md) and
[outcome](POSTGRES_TEST_TEMPLATES_OUTCOME.md) distinguish sources from execution.

## Scope and decision

Prepare one migration-only, run-local template in the existing per-file runtime.
Only Wanted explicitly selects `schemaMode: 'migration_template'`; every variant
still owns a newly created database, new pool, fixture seeds and real transactions.
The default runtime remains empty-database preparation. Migration, bootstrap,
recovery and app-global environment paths stay independent. No branch, release,
tag, deployment, PR merge, dependency or application schema change is introduced.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| More workers or longer deadlines | Easy configuration | Earlier parallel profile failed; obscures ownership and setup cost | Reject |
| Shared scenario database or outer rollback | Avoids setup | Invalidates cross-client commits, fault triggers and race controls | Reject |
| Per-file pristine template and independent clones | Amortizes measured migration work with narrow adoption | Requires sealing, input verification and explicit cleanup | Implement first |
| Persistent cross-run cache | Potential reuse | Stale schemas and unowned resources across runs | Reject |
| Parent-owned PostgreSQL across files | Fewer container starts | New subprocess/server ownership and capacity contract | Later, after template proof |

Stack: isolated Node runner; focused/fast feedback; real PostgreSQL acceptance;
run-local migration fingerprint; sealed private template; fresh scenario clones;
registered work and strict owned cleanup; one stable complete serial gate.
Measure baseline/template phases and unchanged behavior before selecting Wanted's
template profile. Preserve all existing case assertions and deadlines.

## Modular ownership

`migration-template-inputs.js` fingerprints actual ordered migration filenames,
keys, descriptions and SQL checksums, fixed preparation-source bytes/version and
actual database/server encoding/locale configuration. Snapshot bytes are excluded
because this mode never loads a snapshot. Recheck before/after preparation and
before each clone; drift refuses admission without silently rebuilding/falling back.

`migration-template-preparation.js` binds migration application and complete ledger
verification to the template pool. It additionally verifies migration keys.
It avoids `prepareDatabase`, whose default migration calls currently do not forward
an injected pool. The production preparation wrapper is outside this change.

`postgres-template-store.js` owns maintenance-connection SQL. Create from template0,
retain positive CREATE acknowledgement and database OID/role ownership, close the
preparation pool, disable new connections and verify zero active source sessions.
Do not set IS_TEMPLATE true or grant additional cloning authority. Explicitly
enable connections on clones; database settings/GRANTs are not assumed copied.

`postgres-migration-template.js` publishes only a private verified source after
preparation/sealing. Cases receive clone pools, never the source pool/reference.
Register clone work before any await, close admission before teardown, drain
registered work, drop only the positively created source with matching observed
OID/ownership, then stop the runtime-owned server. External mode owns its created
databases, not the server. Each clone uses its own maintenance connection; queries
on any single pg client remain sequential.

The temporary-database helper gains an internal creation adapter and opt-in strict
cleanup: original setup/work errors win over secondary cleanup errors, while an
otherwise successful case cannot claim success after incomplete cleanup. Defaults
retain their existing contract. Creation collision never authorizes destructive
cleanup of the existing database.

## Acceptance and limits

Prove input drift/ledger failure refusal, pool binding, failed preparation/sealing,
pre-aborted and closed-owner refusal, registration/drain ordering, collision and
observed OID replacement protection. Real PostgreSQL controls must prove one
schema build serves fresh clones; case rows, triggers, leases and modifications
cannot contaminate later clones; source connections refuse; sibling databases
survive failure/cancellation/cleanup.

Compare Wanted baseline and selected template profiles with the same ten cases,
thirty variants, assertions and scheduling. Keep its migration call as an
idempotent per-clone check. Dedicated migration/bootstrap tests remain untemplated.
No universal speedup or CI capacity follows from a local measurement.

Connection sealing is not protection from another privileged administrator.
Observed identity/configuration drift is refused; this is not an atomic defense
against adversarial administrative SQL. Cancellation requests cooperative stop;
unabortable SQL and unregistered leaked-client pool shutdown remain explicit
limits. Safe phase records omit names, credentials, SQL and paths; independent
native logs are not globally sanitized. No UI/WCAG conformance claim follows.
