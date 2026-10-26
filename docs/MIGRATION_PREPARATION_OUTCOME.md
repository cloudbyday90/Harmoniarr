# Migration preparation: outcome

Date: October 26, 2026. Implements the next item in the
[startup lineage outcome](STARTUP_MIGRATION_LINEAGE_OUTCOME.md).
See separate [research](MIGRATION_PREPARATION_RESEARCH.md),
[design](MIGRATION_PREPARATION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_MIGRATION_PREPARATION_OUTCOME.md).

## Result

The migration writer now captures a frozen manifest and validates existing history
on its captured client before extension, UUID function or ledger DDL and pending
SQL. Known absent migrations remain pending. Unknown applied history, checksum/key
drift and blocked non-applied rows fail with bounded guidance. A missing ledger in
a nonempty public schema, or an empty ledger alongside other relations, cannot
authorize replay. Catalog classification also protects snapshot bootstrap when
information_schema visibility makes an existing schema appear empty.

Default preparation no longer retries failed rows silently. Explicit
`npm run migrate -- --retry-failed` admits only known failed rows whose filename,
key and checksum still match captured SQL. Running, unknown or incompatible rows
remain blocked. The exact packaged migration retry command owns guarded preparation
in Docker and executes once; normal application startup keeps default preparation.
No repair/bypass environment variable is introduced.

prepareDatabase now forwards its pool factory through all phases. Writer/bootstrap
cleanup preserves the primary Error/null if release also fails. Existing SQL lives
in the store; policy and CLI options have small ESM modules. No migration SQL,
schema snapshot, dependency, production role or second service was added.

## Validation

| Scope | Result |
| --- | --- |
| Focused preparation/bootstrap/template/startup/diagnostic/snapshot cohort | 37 passed, no skips |
| Complete fast server/client/script suites | 6,153 / 4,497 / 700 passed; no failures, cancellations or skips |
| Node baseline, copyright, migration/ID policy, schema snapshot, ESM, image tags, Compose topology, lint, test hygiene and build | Passed |
| Production npm audit | Zero reported vulnerabilities |
| Initial native CLI/preparation qualification | Twelve diagnostic cohorts, six startup refusals, seven preparation refusal cases, real pending upgrade and explicit failed retry passed |
| Final-image real entrypoint qualification | Seven scenarios passed across 15 containers/seven labelled volumes; all owned resources retired |
| Final-image CLI, HTTP/backup and startup/recovery entries | Passed without packaged production-code overlays |
| Final-image container replacement recovery | All 18 backup publication/deletion checkpoints passed across 19 production-entrypoint containers |
| Final-image standalone fresh writer | Applied all 115 SQL files to an acknowledged fresh database, replayed zero, retained ledger hashes and passed full startup lineage; database/container retired |

Unit checks cover empty/nonempty schema classification, invalid history, matching
failed consent, manifest mutation during observation, pre-DDL ordering, pending-SQL
selection, exact CLI arguments, pool forwarding and Error/null cleanup. Initial
native refusal checks retained full ledger and UUID function catalog identity under
a DDL tripwire. Valid upgrade/retry cases recreated the real final migration's
index and returned the ledger to applied state. No live data fault was used.

The final immutable image's actual entrypoint refused checksum drift, key drift,
unknown applied history, failed rows and a missing ledger before the DDL tripwire
or application command. A valid pending migration applied once and became healthy.
The exact explicit retry command ran without default pre-preparation, applied one
reviewed failed migration and supported a later normal healthy startup. Frozen
entrypoint bytes/mode matched source in the image. Every scenario used the same
owned volume across seeding and restart; all 15 containers and seven volumes retired
with absence verified. These are isolated faults, not mutations of the preserved
deployment.

Final packaged CLI checks retained all twelve diagnostic cohorts, six startup
refusals and seven preparation refusal cases, plus real pending upgrade and manual
retry. HTTP/backup checks retained 20 concurrent reads, three verified encrypted
artifacts/manifests, idempotency, authorization/CSRF/no-store, unavailable-state
projection, audit/journal checks and actual restore apply. Startup/recovery passed
with background services enabled. Six mapped native binary hashes and configured
backup-root publication/readiness/retirement checks passed. Live status/checksum/
diagnose commands retained 115 current rows and unchanged ledger/UUID catalog hashes.

The final image also passed all 18 real SQL rollback-wait/lost-acknowledgement backup
replacement checkpoints. Each SIGKILL exited 137 without OOM; same-volume startup
observed WAL redo, became schema/HTTP ready and completed automatic/repeated recovery
with fresh bytes/catalog verification. Every probe, container and the owned volume
retired with absence verified. This matrix concerns backup publication/deletion,
not migration atomicity or hardware power loss.

A separate final-image probe created an acknowledged fresh database in the admitted
isolated PostgreSQL cluster and invoked the standalone writer without snapshot
bootstrap. All 115 SQL files applied; a second invocation applied zero and retained
the complete ledger hash. Full startup-lineage validation passed through the supplied
pool factory. After draining the owned pool, the probe verified zero target sessions,
dropped only its acknowledged database and verified absence. Its container also
retired. This qualifies the direct fresh-writer path in addition to Docker snapshot
bootstrap.

## Recommendation and limits

Keep immutable manifest → catalog classification → existing-history guard →
explicit failed-row consent if needed → pending SQL → startup lineage assertion.
It stops incompatible history before preparation writes while preserving normal
pending upgrades. The cost is an operator decision and independent maintenance
path when failed or incompatible records block startup.

The guard checks recorded identity, not live DDL equivalence. Missing rows remain
pending under the existing migration contract; it cannot distinguish history
deletion from a newly absent file. Quiesce writers because independent migration
commands/external SQL are not serialized by this change. Failed-row consent does
not prove rollback or idempotency, and it does not clean leftover objects.

The subsequent [transaction ownership outcome](MIGRATION_TRANSACTIONS_OUTCOME.md)
resolves the writer/SQL framing overlap without rewriting historical checksums
and qualifies DDL/ledger commit visibility, rollback and real lost acknowledgements.
Next: coordinate cooperating preparers across bootstrap, admission and writes.

GitHub MCP found no open PRs in cloudbyday90/Harmoniarr, making random local PR
application and stale-PR cleanup/rebase inapplicable. This work stays on main;
no release, tag, new branch or PR merge is part of it. No markup changed; prior
W3C UI evidence and deferred manual assistive-technology checks remain separate.
