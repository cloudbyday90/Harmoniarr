# Startup migration lineage: outcome

Date: October 26, 2026. Implements the next item from the
[migration CLI readers outcome](MIGRATION_CLI_READERS_OUTCOME.md).
[Research](STARTUP_MIGRATION_LINEAGE_RESEARCH.md),
[design](STARTUP_MIGRATION_LINEAGE_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_STARTUP_MIGRATION_LINEAGE_OUTCOME.md) are separate
documents with source links, tradeoffs and deployment evidence.

## Result

Application startup now requires complete prepared migration lineage before path
readiness, application composition, listening and recovery/background ownership.
The narrow startup-migration-validation-service.js reuses the existing read-only
observer and the runtime's supplied pool owner. It refuses pending/non-applied
rows, unknown applied rows, checksum drift, migration-key drift and an empty
repository manifest. Database or manifest failures propagate without retry.

The shared report now compares migration keys instead of merely collecting them.
Privileged diagnose output includes key-drift findings; snapshot validation also
rejects that drift. Template preparation retains an independent exact-row check,
including a forged-current-report regression. Existing status/checksum CLI exit
policies and diagnose's report-only exit behavior are preserved.

Automatic lineage-refusal messages contain fixed guidance and numeric counts,
excluding stored filenames, checksums and error messages. The guard preserves
observation Error/null identity. Existing reporting, pool cleanup and failing
process exit remain owned by the normal entrypoint.

No new app, external service, pool, production credential, schema migration,
dependency or bypass mode was added. The implementation is ESM, with startup
policy in a small service.

## Validation

| Scope | Result |
| --- | --- |
| Focused startup/report/template/preparation/diagnostic/snapshot cohort | 34 passed, no skips |
| Complete fast server/client/script suites | 6,144 / 4,497 / 700 passed; no failures, cancellations or skips |
| Node baseline, copyright, migration/ID policy, schema snapshot, ESM, image tags, Compose topology, lint, test hygiene and build | Passed |
| Production npm audit | Zero reported vulnerabilities |
| Candidate native PostgreSQL/CLI qualification | Twelve concurrent diagnostic cohorts passed; six invalid-state startup attempts refused |
| Final packaged native CLI, HTTP/backup and startup/recovery entries | All three passed without packaged production-code overlays |
| Final live status/checksum/diagnose commands | Passed; 115 rows remained current with unchanged ledger and UUID catalog hashes |
| Final image container replacement recovery | All 18 checkpoints passed across 19 production-entrypoint containers |

The unit cohort covers nonempty/current admission, every inconsistency category,
empty-manifest refusal, migration-key mismatch/null, bounded messages, supplied pool
ownership, original Error/null and refusal before path validation or createApp.
Existing positive startup, idle mode and shutdown behavior remain covered. Fast
gate diagnostics from negative backup-journal and PWA-registration fixtures were
reviewed; they were expected fixture output, not unresolved gate failures.

The native fault fixture admits only its disposable PostgreSQL/memory profile.
It retains SELECT-only/read-only observer checks and a DDL negative control.
Pending, checksum-drift, unknown-applied, failed-row, migration-key-drift and
missing-ledger startup children exit 1 before listening. Complete ledger hashes
and UUID function OID/xmin/definition hashes match before/after each refusal.
Stored private error/checksum/key/filename sentinels are excluded from startup
messages. Actual child completion is required; timeout/signal termination cannot
be counted as a passing refusal.

The same twelve-cohort/six-refusal entry passed against the final immutable image.
Its HTTP/backup regression retained 20 concurrent reads, three verified encrypted
backup files/manifests, idempotency, pending/unavailable handling, administrator,
CSRF and no-store checks, audit/journal verification and actual restore apply.
The separate startup/recovery regression passed with background services enabled,
including held records, bounded recovery, exact paging, continuation and safe
administrator status. All three owned native containers were removed and absence
verified. Configured-bind readiness and six mapped native binary hashes also passed.

The final immutable image passed all 18 publication/deletion container replacement
checkpoints, covering real SQL rollback waits and lost acknowledgements. Each
replacement used the same owned test volume, observed WAL redo, passed schema/HTTP
readiness and completed automatic/repeated recovery with background services enabled
and the stronger lineage guard active. SIGKILL exited 137 without OOM; fresh file
bytes and catalog state were verified. Containers, probes and the owned volume
retired with absence verified. This is container/process crash evidence, not a
power-loss test.

## Availability and recovery decision

Refusing startup also leaves HTTP recovery unavailable. Operators must retain an
independent maintenance/diagnostic connection and establish matching application
files and a verified compatible database, or review explicit migration work before
retry. History/checksum rewriting is not an automatic recovery action.

Docker still runs existing explicit preparation first, including its current
pending/failed retry behavior. This guard validates the resulting state; it does
not prevent preparation writes against previously inconsistent applied history.
That distinction is documented rather than treating direct-node fault tests as
proof of a pre-migration entrypoint guard. The check also does not lock out later
external writers or certify live DDL objects; deployment/migration ownership must
quiesce writers.

No browser markup changed. Existing W3C status/focus behavior remains applicable;
manual screen-reader and physical-device acceptance remains deferred. Unchanged
media, codec and other filesystem/SQL matrices retain preceding runtime evidence
and are not counted as new results here.

GitHub MCP found no open PRs in cloudbyday90/Harmoniarr. Random local PR application
and stale-PR cleanup/rebase were therefore inapplicable. Work uses main without
creating a branch, release, tag or PR merge.

Recommended stack: explicit preparation → local manifest and single ledger
observation → shared lineage report → bounded fatal assertion → normal startup.
It blocks application writers on rejected prepared state while accepting the
availability cost of an operator-resolved startup refusal.

Next: add an applied-history preflight before migration preparation writes. Allow
legitimate absent pending migrations, reject existing checksum/key/unknown-row
inconsistencies, and define failed-row retry ownership separately. Qualify the real
Docker entrypoint against bad history and valid pending upgrades before promoting
that stricter preparation policy.
