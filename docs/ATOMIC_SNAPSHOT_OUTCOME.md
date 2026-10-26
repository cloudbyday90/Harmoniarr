# Atomic snapshot bootstrap outcome

October 26, 2026. See [research](ATOMIC_SNAPSHOT_RESEARCH.md),
[design](ATOMIC_SNAPSHOT_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_ATOMIC_SNAPSHOT_OUTCOME.md).

Fresh bootstrap verifies exact artifact provenance and executes compiled snapshot
DDL plus applied receipts in one transaction. Complete filename/key/checksum/status
lineage and count are verified before COMMIT. The shared protocol preserves
per-migration failure-receipt behavior without applying it to snapshot rollback.
Historical migration and committed snapshot bytes remain unchanged; the renderer
script's API/output remain compatible.

The stable source passed 75 focused tests and the complete static/server/client/
script/build gate: 6,183 server, 4,497 client and 700 script tests, with zero
failures, cancellations or skips. Checks cover Node baseline, copyright,
migration/schema snapshot, ESM, image tags, Compose topology, lint and test hygiene.
Production npm audit reports zero vulnerabilities. The source freeze covers
3,656 files and hashes all 11 changed code/test files. The full serial integration
suite was not run; directly affected PostgreSQL/caller paths are qualified below.

Native preflight passed seven real PostgreSQL scenarios: full-snapshot visibility
then commit; backend termination/rollback; SQL failure; pre-commit lineage failure;
tamper/stale-prefix refusal; and actual COMMIT dispatch/reply loss. Its seven
acknowledged databases and container retired. Final evidence uses the rebuilt
immutable image.

## Final PostgreSQL evidence

The immutable no-cache image passed all seven snapshot scenarios:

| Scenario | Result |
| --- | --- |
| Held tail after the full corpus | Another connection sees no new public relations, UUID function, pgcrypto extension or ledger; commit publishes 116 receipts including the owned tail fixture |
| Terminate that backend | Entire snapshot rolls back; reviewed bootstrap succeeds after owner retirement |
| Real SQL error after the corpus | All DDL/history rolls back; no outside failed receipt; reviewed retry yields 115 receipts |
| Pre-commit missing receipt | Lineage verification refuses and rolls back all DDL/history |
| Changed artifact or old prefix | Refuses before snapshot DDL |
| Cut COMMIT before server dispatch | Unknown outcome; client destroyed; independent inspection finds fresh state; reviewed bootstrap runs once |
| Cut actual server COMMIT reply | Unknown outcome; client destroyed; 115 applied receipts survive; reviewed bootstrap skips, preserving complete receipt-row hashes |

The protocol fixture forwards no COMMIT acknowledgement in either cut case.
Replay follows independently observed backend/key retirement; the service never
automatically retries or overwrites history. Seven acknowledged owned databases
were dropped with no active sessions and absence verified, and the test container
retired. This establishes transactional database visibility/recovery for the
tested corpus, not external-effect or hardware power-loss durability.

## Caller evidence

The existing six-case preparation-owner and five-case migration transaction
fixtures passed on the same image, retaining cross-process contention, max-1
connection ownership, inherited-key refusal, real backend termination, rollback
and actual acquisition/unlock/COMMIT reply-loss behavior. The direct fresh writer
applied all 115 migrations without loading a snapshot, then replayed zero with
identical ledger bytes and current startup lineage. Its owned database retired.

CLI coverage retained 12 reader cohorts, six startup refusals and seven preparation
refusals, plus ordinary pending upgrade and explicit reviewed failed retry.
Restricted readers could not prepare schema. Observation retained 20 concurrent
reads during backup, three encrypted artifacts/manifests and restore without
schema writes. Startup recovery retained journal/files, administrator-only access
and safe status behavior. All seven native fixture containers retired with absence
verified. Live migration/checksum/diagnostic commands preserved ledger/catalog
identity at 115 applied migrations.

Seven production-entrypoint preparation scenarios passed on their owned volumes:
incompatible history refused before DDL/app startup, ordinary pending work
upgraded healthy, and reviewed failed work required explicit retry. Their
15 containers and seven volumes retired with absence verified. All 18 process/
container replacement checkpoints also passed with production startup/background
services enabled, same-volume WAL recovery, preserved pre-crash records, repeated
recovery and current artifact/catalog state. Owned containers, probes and matrix
volume retired. Hardware power loss was not tested.

The healthy no-cache walkthrough retains its administrator, data and five actual
bind mounts. Runtime/source comparison preserved other server/shared files,
client output, package metadata, dependencies and native binaries. Final source
and committed-artifact checks retain all raw migration/snapshot bytes.

GitHub MCP found no open PRs in cloudbyday90/Harmoniarr; random local PR application
and stale cleanup/rebase were inapplicable. Work stays on main with no release,
tag, new branch or PR merge. No markup changed; manual assistive-technology/device
acceptance remains deferred.

Recommendation: preparation owner → fresh guard → provenance → compile frames →
one transaction → full receipt verification → acknowledged commit. Benefit:
atomic DDL/history. Cost: extra compilation, strict artifact matching and a larger
transaction. It does not establish every live DDL property or authenticate an
untrusted image. Next add pre-commit critical schema-anchor checks and native
missing/altered-anchor rollback proof. That follow-up is now recorded separately
in the [schema anchor outcome](SNAPSHOT_ANCHORS_OUTCOME.md).
