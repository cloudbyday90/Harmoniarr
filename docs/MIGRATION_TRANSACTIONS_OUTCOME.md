# Migration transaction ownership outcome

October 26, 2026. Research, implementation and validation are recorded separately
in the [research](MIGRATION_TRANSACTIONS_RESEARCH.md),
[design](MIGRATION_TRANSACTIONS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_MIGRATION_TRANSACTIONS_OUTCOME.md).

The executor now owns one transaction for each migration's body SQL and checked
applied receipt. All 115 historical SQL files and checksums remain unchanged;
42 files have recognized framing removed only in memory. Every pending file is
compiled before preparation writes. Unknown COMMIT outcomes discard their
connection without rollback, failed-history overwrite or automatic retry.

The stable candidate passed 50 focused migration/bootstrap/startup tests, then
the complete static/server/client/script/build gate: 6,166 server, 4,497 client
and 700 script tests, with zero failures, cancellations or skips. Static checks
include Node baseline, copyright, migration/schema snapshot, ESM, image tags,
Compose topology, lint and test hygiene. The production dependency audit reports
zero vulnerabilities. Source freeze covers 3,643 files and hashes all ten changed
code/test files. The full serial integration suite was not run; the directly
affected PostgreSQL and packaged caller paths are qualified below.

## Real PostgreSQL transaction evidence

The final no-cache image passed five scenarios against its packaged writer:

| Scenario | Observed result |
| --- | --- |
| Held applied-receipt UPDATE after DDL, then commit | Independent connection sees neither table nor receipt before release; both are applied afterward |
| Terminate backend at that same real advisory-lock wait | Neither table nor receipt survives; reviewed pending replay applies once |
| SQL division error after CREATE TABLE | Table rolls back; failed receipt appears only after acknowledged rollback |
| Cut COMMIT before proxy dispatch | Unknown-outcome error; client destroyed; no table/receipt; independent reviewed replay applies once |
| Forward COMMIT, cut actual server COMMIT reply | Unknown-outcome error; client destroyed; applied receipt and table survive; independent replay applies zero files |

Each protocol case used one real PostgreSQL connection, with no COMMIT
acknowledgement forwarded to the client. Neither overwrote history with a failed
receipt. This proves transport ambiguity handling, not a general promise of
idempotency for arbitrary migration effects or hardware power-loss durability.
No automatic retry occurred in the executor; fixture replay followed independent
observation after the disconnected writer settled.

## Caller and deployment evidence

The packaged fresh writer applied all 115 migrations without loading a schema
snapshot, then replayed zero files with identical ledger bytes and current
startup lineage. Its acknowledged private database was dropped and absence
verified. CLI qualification passed 12 reader cohorts, six startup refusals and
seven preparation refusals, plus a normal pending upgrade and explicit reviewed
failed retry. Restricted readers remained unable to prepare schema.

Read-only observation passed 20 concurrent reads during backup, verified three
encrypted artifact/manifests and restored without schema writes. Startup recovery
retained its existing journal/files, administrator-only and safe-status behavior.
On the live walkthrough, all three migration diagnostic commands succeeded while
ledger/catalog identity remained unchanged at 115 applied migrations.

Seven production-entrypoint preparation scenarios passed on their owned volumes:
checksum/key/unknown/failed/missing histories refused before DDL and app startup;
pending work upgraded healthy; reviewed failed work recovered only through
explicit retry. All 15 scenario containers and seven volumes were removed with
absence verified. See the [Docker outcome](LOCAL_DOCKER_MIGRATION_TRANSACTIONS_OUTCOME.md)
for the remaining runtime and restart evidence.

The final no-cache image also passed all 18 process/container crash replacement
checkpoints with full startup and background services enabled. Same-volume WAL
recovery and current artifact/catalog state were verified at every checkpoint;
owned containers, probes and volume were retired. Hardware power loss was not
tested. Final source/runtime hashes and all five preserved walkthrough mounts
matched the recorded candidate. The application remains healthy with its
existing administrator and data.

The first real backend-termination preflight exposed an unhandled connection
error between queries. That failed run was retained and its container retired.
Connection-lifetime error/end handling fixed the issue; the subsequent native
preflight passed, including both real protocol cuts. Passing final evidence is
reported separately from that development failure.

GitHub MCP found no open PRs in cloudbyday90/Harmoniarr. Random local PR
application and stale-PR cleanup/rebase were therefore inapplicable. Work stays
on main, with no release, tag, new branch or PR merge. No UI/markup changed;
manual assistive-technology/device checks remain deferred.

Recommendation: retain immutable history → full pending SQL preflight → single
transaction owner → checked receipt → acknowledged COMMIT. The benefit is atomic
DDL/history; the cost is a narrow SQL policy and explicit independent inspection
after acknowledgement loss. Per-migration atomicity does not serialize writers
or make arbitrary SQL/external effects safe. The subsequent
[preparation serialization outcome](PREPARATION_SERIALIZATION_OUTCOME.md)
coordinates cooperating preparers across bootstrap, history admission, writes
and final verification. Next investigate atomic snapshot bootstrap and actual
interruption/ledger visibility, preserving snapshot provenance.
