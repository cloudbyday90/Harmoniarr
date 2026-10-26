# Migration CLI readers: outcome

Date: October 26, 2026. Implemented from the next recommendation in the
[onboarding migration state outcome](ONBOARDING_MIGRATION_STATE_OUTCOME.md).
See separate [research](MIGRATION_CLI_READERS_RESEARCH.md),
[design](MIGRATION_CLI_READERS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_MIGRATION_CLI_READERS_OUTCOME.md).

## Result

Status, checksum and full-state diagnostics now observe the prepared ledger
without creating an extension, replacing the UUID function or creating a table.
The existing store owns SQL. Narrow ESM services own observation and assertions;
migrations.js retains compatibility exports and the explicit migration writer.
A packaged diagnose entry point shares the existing CLI reporter/cleanup with
the source-script wrapper. No production role, second pool, app, service,
dependency or schema migration was introduced.

Missing or denied ledger reads propagate failure without repair. Status still
rejects pending filenames, checksum checking rejects drift/missing files, and
diagnose still exits successfully after reporting readable inconsistent state.
Startup pending/missing-ledger failures remain fatal before listening. Captured
client release preserves the primary query Error/null over secondary cleanup
failure; cleanup-only failure remains visible.

## Validation

| Scope | Result |
| --- | --- |
| Focused diagnostic, CLI, preparation and template unit cohort | 31 passed, no skips |
| Complete fast server/client/script suites | 6,138 / 4,497 / 700 passed; no failures, cancellations or skips |
| Node baseline, copyright, migration filenames/ID policy, schema snapshot, ESM, image tags, Compose topology, lint, test hygiene and build | Passed |
| Production npm audit | Zero reported vulnerabilities |
| Final packaged CLI PostgreSQL entry | Passed all ten three-command cohorts, source wrapper, explicit preparation and startup refusal checks |
| Final packaged HTTP/backup migration observation entry | Passed concurrent reads, backup overlap and actual restore apply under the DDL guard |
| Final packaged startup/recovery entry | Passed with background services enabled |
| Final image container replacement recovery | All 18 checkpoints passed across 19 containers; owned resources retired |
| Live packaged status/checksum/diagnose commands | Passed; 115 ledger rows and UUID function catalog identity unchanged |

The native CLI entry uses a disposable SELECT-only role with read-only transaction
defaults and no superuser/database/role creation capability. Current state was
exercised concurrently and in repeated waves. Pending, checksum-drift, unknown-row,
denied-SELECT and missing-ledger states produced the existing command-specific
exit codes. Each cohort retained the complete ledger hash and UUID function
OID/xmin/definition hash. Negative controls rejected schema preparation; explicit
owner preparation succeeded when the fixture guard was disabled. Actual child
completion and output were observed, without treating timeout/signal termination
as success.

The HTTP/backup entry retained 20 concurrent reads, three verified encrypted
backup files/manifests, idempotent replay, pending-state refusal, unavailable-state
projection, administrator/CSRF/no-store checks, audit/journal consistency and a
real restore apply. Normal startup recovery retained its paging, continuation,
maintenance and safe-status checks. All three final native entries ran against
the immutable final image without production-code overlays; owned containers
were removed and absence verified.

The final image also passed all 18 container replacement checkpoints, covering
real SQL rollback waits and lost acknowledgements across publication and deletion.
Each production-entrypoint replacement used the same owned test volume, became
HTTP/schema ready with background services enabled, observed WAL redo and recovered
automatically. SIGKILL exited 137 without OOM; fresh bytes/catalog checks and repeated
recovery passed. All containers, probes and the test volume retired with absence
verified. This is process/container crash evidence, not a power-loss test.

A final trailing-blank-line-only correction was verified against the qualified
source bytes. The full fast gate was retained; source hashes, no-cache packaging
and final native proofs were refreshed. Gate warnings were expected negative
backup-journal fixture diagnostics, not failing lint/build checks.

No browser markup changed. Existing accessibility behavior remains covered by
preceding evidence; manual screen-reader and physical-device acceptance remains
deferred. Unchanged media/native codec and other filesystem/SQL fault matrices
retain preceding source/runtime evidence and are not reported as new runs here.

GitHub MCP searches found no open PRs in cloudbyday90/Harmoniarr, so random local
PR implementation and stale-PR cleanup/rebase were inapplicable. This work uses
main without creating a branch, release, tag or PR merge.

## Recommendation

Keep explicit preparation → narrow read-only services → SQL store → existing CLI
reporting/cleanup → restricted-role native qualification. The benefit is removal
of unnecessary schema-write privilege and catalog contention from diagnostics.
The tradeoff is that an absent schema requires explicit preparation, while a
dedicated production observer credential remains a separate operational decision.

Next: design and qualify full-lineage startup validation before listening,
including checksum drift and unknown applied rows. Current startup checks pending
filenames and service/path readiness; it does not enforce the full-state report.
Define bootstrap/recovery remediation and availability policy before adding that
gate. The read-only full-state service is now available for that work.

Implemented in the [startup migration lineage outcome](STARTUP_MIGRATION_LINEAGE_OUTCOME.md).
That follow-up records checksum/key/status/unknown-row admission, bounded startup
diagnostics and the explicit preparation/recovery availability boundary.
