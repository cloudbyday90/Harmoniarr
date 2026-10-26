# Migration transaction ownership design

## Contract and boundaries

The old writer opened a transaction around SQL files, 42 of which contain
transaction framing. A file's COMMIT could commit DDL before the writer marked
its ledger row applied. One captured PostgreSQL client now owns BEGIN, body SQL,
receipt completion and COMMIT. Atomicity is per migration; schema preparation
and earlier successfully applied migrations are outside a later migration's
transaction. No historical SQL, checksum, table or schema snapshot changes.

`migrations.js` owns connection checkout, history validation, full pending-plan
compilation, preparation DDL and release. `migration-sql-lexer.js` identifies
top-level command spans. `migration-sql-transaction-policy.js` enforces supported
framing. `migration-transaction-service.js` owns the protocol state machine.
`migration-ledger-store.js` owns parameterized running/applied/failed receipts.
All modules are ESM inside the existing application.

## SQL admission

Compile every pending file before any preparation DDL or migration execution.
Accept an unframed body or a plain BEGIN [WORK|TRANSACTION] / COMMIT
[WORK|TRANSACTION] outer frame. One historical migration has an empty leading
BEGIN/COMMIT before its DDL; remove that empty frame as well. Blank accepted
frame spans in memory, preserving line positions and UTF-16 offsets. Hash the
untouched raw SQL in the immutable manifest.

Ignore semicolons and apparent commands in single-quoted strings, E strings,
doubled quoted identifiers, line/nested block comments and tagged/untagged dollar
bodies. Reject unterminated forms, empty bodies, split meaningful transactions,
transaction modes/chaining, nested controls and top-level BEGIN, START, COMMIT,
END, ROLLBACK, ABORT, SAVEPOINT, RELEASE, PREPARE, EXECUTE, SET, RESET, DISCARD
or COPY. Unsupported files fail with `migration_sql_transaction_invalid`.

This is deliberately a narrow policy for reviewed trusted SQL. It neither
validates all PostgreSQL grammar nor constrains arbitrary functions, privileges,
external effects or session changes hidden in expressions. PostgreSQL remains
the syntax/execution authority. Nontransactional operations need a separately
reviewed design rather than an escape hatch in this executor.

## Execution and failure outcomes

Require the public client transaction status to be idle before preparation and
each migration. Reject active, failed or unknown state and discard that client.
After BEGIN, require active state; set local standard_conforming_strings and
synchronous_commit to on. Insert the running receipt, execute the compiled body
and update exactly one applied receipt before sending COMMIT. Accept success
only for a COMMIT command acknowledgement with idle status.

| Observed outcome | Executor behavior |
| --- | --- |
| BEGIN fails or status is unrecognized | Discard; preserve original failure; no journal |
| Body or applied receipt fails | Attempt ROLLBACK on the same client |
| ROLLBACK acknowledged and idle | Attempt failed receipt outside the rolled-back transaction |
| ROLLBACK unacknowledged or failed | Discard; no failed receipt; preserve original Error or null |
| Failed receipt write fails | Discard; preserve original Error or null |
| COMMIT explicitly reports ROLLBACK and idle | Known rollback; failed receipt may be recorded |
| COMMIT throws or acknowledgement/state is unrecognized | `migration_commit_outcome_unknown`, original cause retained; discard; no rollback, failed receipt or retry |
| Release fails after acknowledged COMMIT | Propagate cleanup failure without changing committed history |

Connection error/end listeners cover the complete checked-out lifetime, including
gaps between queries. Remove owned listeners on release; unusable connections
use the public `release(true)` disposal path. The shared cleanup helper preserves
primary failures if release also fails.

## Operator recovery and limits

An uncertain COMMIT is not proof of failure. Stop all migration/preparation
writers, let the disconnected backend settle, then run `npm run diagnose:migrations`
through an independent maintenance connection. An applied matching receipt means
do not replay. An absent receipt is eligible for ordinary pending execution only
after the failed backend is gone and the deployment/history has been reviewed.
Failed/running/incompatible rows still use the existing preparation refusal and
explicit reviewed failed-row retry contract. Never delete history to force replay.

The failed receipt is best effort after a confirmed rollback; connection loss
can leave no failure row. Durable logs and independent inspection still matter.
Local synchronous_commit cannot override disabled fsync or faulty storage.
Quiesce writers: concurrent preparers/external SQL remain uncoordinated. The next
item is a shared preparation lock spanning bootstrap, history validation and
writes, with native concurrent-writer qualification.

## Validation ownership

Unit tests cover all 115 immutable files, 42 accepted frames, lexical/control
refusals before preparation DDL, transaction states and Error/null precedence.
The native fixture blocks the real applied-receipt UPDATE after DDL, verifies
both remain invisible from another connection, then commits or terminates the
backend. A SQL error verifies DDL rollback and the subsequent failed receipt.
A disposable loopback PostgreSQL protocol proxy cuts COMMIT before dispatch or
cuts its actual server acknowledgement; independent reads and replay distinguish
the outcomes. This is real transport evidence, separate from mocked unit errors.
Fixtures own pools, lock release, socket drains and exact container retirement.
See [outcome](MIGRATION_TRANSACTIONS_OUTCOME.md) for measured results and limits.
