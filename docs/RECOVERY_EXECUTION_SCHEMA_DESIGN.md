# Recovery execution schema design

Date: 2026-10-15. Scope: the seven existing recovery execution/reconciliation
cases, each using one private PostgreSQL database. Work stays on main without
a release, tag, PR merge or new branch.

## Decision and boundaries

Reuse the recovery scenario adapter for pool-bound idempotent schema preparation
and full scenario timing. Forward the actual test signal as fixtureSignal so
the existing execution helper keeps its cancellation and actual-completion
contract. Add an independent execution schema policy in the existing recovery
policy module; HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE accepts only
empty or migration_template. The transaction policy remains independent.

Initially keep empty as execution's default. Compare explicit empty/template/
template/empty on identical instrumented code before selecting a default.
Preserve all seven original case bodies, fresh services/seeds, real transactions,
provider preparation, lost-response/no-second-POST, provenance/current-authority,
required-audit rollback and reconciliation assertions.

The execution fixture already registers and awaits the actual worker completion
handle through returned provider/Activity work and heartbeat/lease finalization.
Reconciliation is a directly awaited service call, not another detached worker.
No extra worker owner, polling delay, retry, pool/deadline increase or production
change is warranted. This slice does not expand the shared-parent allowlist.

## Evidence plan

Container-free controls cover independent mode/default/refusal behavior and the
actual fixture signal. Existing lifecycle/worker-completion controls remain.
Native controls hold the real worker at provider and lease-release boundaries,
verify terminal status and released lease are earlier than completion, cancel
with Error/null, then prove the database/pool stay available until actual drain.
A subsequent clone from the same template must have no prior users, candidates,
runs, events, transfer links or leases, and must execute fresh recovery work.

Compare seven schema/scenario spans and identical native case/outcome digests,
with zero skips and completed server/database release. Template mode intentionally
adds one source database and preparation/drop. Preserve source fingerprints
before/after every sample. Use the existing process/reporter/phase machinery;
inclusive spans are not additive elapsed time. If only the scoped default is
promoted afterward, freeze and validate final source separately.

The executed controls and both-order comparison support migration_template as
this suite's final default. Explicit empty remains the comparator; see the
outcome for separate candidate and final-source evidence.

## Security and limits

Reuse existing sealed-source identity/fingerprint checks and strict cleanup.
Keep credentials, native logs and scenario identities private; publish bounded
numeric evidence and digests. Database settings/permissions require explicit
runtime configuration rather than assumed inheritance. Controlled provider
callbacks do not prove live remote downloads, whole-app drainage, hosted-CI speed
or WCAG conformance. Dedicated migration/bootstrap acceptance stays independent.

See [official research/options](RECOVERY_EXECUTION_SCHEMA_RESEARCH_2026_10.md)
and [outcome](RECOVERY_EXECUTION_SCHEMA_OUTCOME.md).
