# Database preparation serialization outcome

October 26, 2026. See the separate [research](PREPARATION_SERIALIZATION_RESEARCH.md),
[design](PREPARATION_SERIALIZATION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PREPARATION_SERIALIZATION_OUTCOME.md).

Cooperating bootstrap, migration and composed preparation entry points now use
one nonwaiting database-local session owner. The composed path holds one client
through final status verification; standalone paths use the same reserved key.
Contention refuses before preparation reads/writes. Uncertain acquisition/unlock
and lost connections discard their client without replaying work or rewriting
history. No historical SQL, schema snapshot, dependency or database schema changes.

The stable candidate passed 58 focused migration/bootstrap/ownership/startup
tests and the complete static/server/client/script/build gate: 6,174 server,
4,497 client and 700 script tests, with zero failures, cancellations or skips.
Checks include the Node baseline, copyright, migration/schema snapshot, ESM,
image tags, Compose topology, lint and test hygiene. The production dependency
audit reports zero vulnerabilities. Source freeze covers 3,649 files and all
16 changed code/test files. The full serial integration suite was not run;
directly affected real PostgreSQL/caller qualification is recorded separately.

## Native ownership evidence

The final immutable no-cache image passed all six ownership scenarios:

| Scenario | Observed result |
| --- | --- |
| Composed preparation | Snapshot and final status complete with pool max 1; three standalone/composed contenders and two actual CLI processes refuse busy |
| Across commits | First migration is committed and visible while the second waits on a real PostgreSQL advisory lock; the preparation key remains held; contender refuses before manifest observation; reviewed replay applies zero |
| Another database | Its snapshot preparation completes while the first database's writer remains held |
| Backend termination | Actual end event invalidates the scope; session key disappears; client is destroyed; subsequent independent owner succeeds |
| Inherited reserved key | Work refuses before recursive acquisition; discarded session retires its key |
| Acquisition/unlock reply loss | Proxy observes PostgreSQL's true boolean result but forwards no row; each client is destroyed; acquisition admits zero manifest reads, while lost unlock preserves committed applied history |

The table separates database isolation from the combined cross-commit scenario;
the fixture emits six result records, with acquisition and unlock loss recorded
individually. Reviewed replay after independent backend/key retirement applies
one file for lost acquisition and zero for lost unlock. No automatic service
retry occurred. Both acknowledged fixture databases were dropped with no active
sessions and absence verified; test containers retired as well.

## Caller evidence

The packaged direct fresh writer applied all 115 migrations without loading a
snapshot, then replayed zero with identical ledger bytes and current startup
lineage. Its acknowledged database retired. The existing transaction fixture
passed all five visibility/rollback/real COMMIT-loss cases; reviewed replay now
explicitly waits for the disconnected preparation owner's server lock to retire.

CLI qualification retained 12 reader cohorts, six startup refusals and seven
preparation refusals, plus normal pending upgrade and explicit reviewed failed
retry. Restricted readers could not prepare schema. Read-only observation retained
20 concurrent reads during backup, three encrypted artifact/manifests and restore
without schema writes. Startup recovery retained its existing journal/files,
administrator-only access and safe status behavior. All six native fixture
containers retired with absence verified.

Live migration/checksum/diagnostic commands succeeded without changing the
115-row ledger or catalog identity. Seven production-entrypoint preparation
scenarios passed on their owned volumes: incompatible history refused before DDL
and app startup, ordinary pending work upgraded healthy, and reviewed failed work
required explicit retry. All 15 scenario containers and seven volumes retired
with absence verified. See the Docker outcome for final replacement evidence.

The final no-cache image passed all 18 process/container replacement checkpoints
with production startup/background services enabled, same-volume WAL recovery,
preserved pre-crash records, repeated recovery and current artifact/catalog
verification. Owned containers, probes and matrix volume retired. Hardware power
loss was not tested. Runtime/source comparison preserved all other server/shared
files, client output, dependencies and native binaries; the healthy walkthrough
retains its administrator, data and five actual bind mounts.

The first native preflight failed because its fixture expected transaction status
to become null after backend termination. The pinned driver retains its last
ReadyForQuery status. The fixture now registers and observes the actual end event;
production already used error/end invalidation. The failure log and exact container
retirement were retained. The corrected native preflight passed separately.

GitHub MCP found no open PRs in cloudbyday90/Harmoniarr, so random local PR
application and stale-PR cleanup/rebase were inapplicable. Work stays on main;
no release, tag, branch creation or PR merge. No markup changed; manual
assistive-technology/device acceptance remains deferred.

The recommended stack is one idle captured connection → inherited-lock refusal →
nonwaiting session admission → guarded preparation/transactions → same-client
verification → acknowledged unlock/release. This prevents cooperating stale-plan
races across processes and commits, at the cost of explicit busy retry and a
physical-session requirement. It does not coordinate nonparticipants or make a
whole snapshot/batch atomic. Next: investigate atomic snapshot bootstrap and
real interruption/ledger visibility while preserving snapshot provenance.
