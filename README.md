# Harmoniarr

Harmoniarr is a self-hosted, Docker-hosted music library manager inspired by Lidarr, with Soulseek as the primary acquisition source.

The repository contains the Node.js ESM server, Vue client, PostgreSQL schema, automated validation, and design documents. The platform is under active development toward its first release.

Music Queue recovery transactions now measure all fourteen scenario preparations
and use the existing migration-only template with fresh clone state. See the
[design](docs/RECOVERY_SCHEMA_TEMPLATE_DESIGN.md),
[official research and tradeoffs](docs/RECOVERY_SCHEMA_TEMPLATE_RESEARCH_2026_10.md)
and [outcome](docs/RECOVERY_SCHEMA_TEMPLATE_OUTCOME.md) for scoped adoption,
both-order local evidence and the retained explicit empty-schema comparator.

An explicit `npm run measure:postgres-cohort` command compares the complete
five-file PostgreSQL cohort in both profile/file orders, verifying native cases,
work counts, source identity and cleanup. See its
[design](docs/POSTGRES_COHORT_COMPARISON_DESIGN.md),
[official research and tradeoffs](docs/POSTGRES_COHORT_COMPARISON_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_COHORT_COMPARISON_OUTCOME.md) for local measurements,
immutable image prerequisites and the separate default-scheduling decision.

Shared PostgreSQL startup now checks cancellation after acquisition and before
runtime publication, awaiting the current cleanup owner and preserving the
original result. See the [design](docs/POSTGRES_STARTUP_CANCELLATION_DESIGN.md),
[official research and tradeoffs](docs/POSTGRES_STARTUP_CANCELLATION_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_STARTUP_CANCELLATION_OUTCOME.md) for native ownership
proof and the next targeted validation recommendation.

Shared PostgreSQL startup now guards connection-metadata capture and awaits
owned cleanup on setup failure while preserving original failures. See the
[design](docs/POSTGRES_STARTUP_GUARD_DESIGN.md),
[official research and tradeoffs](docs/POSTGRES_STARTUP_GUARD_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_STARTUP_GUARD_OUTCOME.md) for native retirement proof
and the original cancellation probe, addressed in the outcome above.

Shared PostgreSQL fixtures now seal admission and drain full database operations
before template/server teardown, using the existing lifetime owner. See the
[design](docs/POSTGRES_RUNTIME_LIFETIME_DESIGN.md),
[official research and tradeoffs](docs/POSTGRES_RUNTIME_LIFETIME_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_RUNTIME_LIFETIME_OUTCOME.md) for native ordering proof
and runtime lifetime limits.

Shared empty-schema fixtures now report temporary-database release failures
through the existing strict lifecycle. See the
[design](docs/POSTGRES_DATABASE_RELEASE_DESIGN.md),
[official research and tradeoffs](docs/POSTGRES_DATABASE_RELEASE_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_DATABASE_RELEASE_OUTCOME.md) for native permission-
refusal proof and database-release ownership limits.

Shared PostgreSQL cleanup now reports server-stop failure in either schema mode,
preserving original failures and independent workspace guards. See its
[design](docs/POSTGRES_RUNTIME_CLEANUP_DESIGN.md),
[official research and options](docs/POSTGRES_RUNTIME_CLEANUP_RESEARCH_2026_10.md)
and [outcome](docs/POSTGRES_RUNTIME_CLEANUP_OUTCOME.md) for native evidence and
server-stop ownership limits.

An explicit Linux canonical media lane now requires all six cases, zero skips,
27 current inspections and verified media-owner cleanup. A manual-only Ubuntu
workflow keeps it selected. See its
[design](docs/LINUX_CANONICAL_MEDIA_DESIGN.md),
[research](docs/LINUX_CANONICAL_MEDIA_RESEARCH_2026_10.md) and
[outcome](docs/LINUX_CANONICAL_MEDIA_OUTCOME.md) for the native replay and limits.

The reversed complete media cohort passed in both modes. Its API option remains
explicit while Linux canonical coverage is pending. Media tools and option
policy now load independently of SQL fixtures. See the rollout
[design](docs/LIBRARY_ADD_MEDIA_ROLLOUT_DESIGN.md),
[research](docs/LIBRARY_ADD_MEDIA_ROLLOUT_RESEARCH_2026_10.md) and
[outcome](docs/LIBRARY_ADD_MEDIA_ROLLOUT_OUTCOME.md) for measured scope and limits.

The canonical Add to library cohort now supports explicit scenario-owned API
media inspection while keeping every authorization, rollback and current-byte
check. The per-command default remains available. See its
[design](docs/LIBRARY_ADD_MEDIA_PILOT_DESIGN.md),
[official research](docs/LIBRARY_ADD_MEDIA_PILOT_RESEARCH_2026_10.md) and
[outcome](docs/LIBRARY_ADD_MEDIA_PILOT_OUTCOME.md) for measured rollout limits.

Reusable app fixtures now guard both scenario and parent workspace cleanup,
drain admitted database work and retain uncertain children. Fresh per-invocation
directories isolate repeated labels. See the
[design](docs/REUSABLE_WORKSPACE_CLEANUP_DESIGN.md),
[official research](docs/REUSABLE_WORKSPACE_CLEANUP_RESEARCH_2026_10.md) and
[outcome](docs/REUSABLE_WORKSPACE_CLEANUP_OUTCOME.md) before owned executor adoption.

The largest noise/eight-binding owned API selection now completes its canonical
comparison. A separate explicit native lane proves Linux socket reads against
acknowledged running/active-exec/stopped owner states. Defaults remain unchanged.
See the [design](docs/MEDIA_API_SCALE_DESIGN.md),
[official research](docs/MEDIA_API_SCALE_RESEARCH_2026_10.md) and
[outcome](docs/MEDIA_API_SCALE_OUTCOME.md) before expanding fixture adoption.

Owned workloads can opt into local Engine inspection with `--media-execution
owned --media-inspection api`. Versioned, bounded GETs preserve every current
owner check; exec and lifecycle mutations stay on CLI. Defaults remain unchanged.
See the [design](docs/MEDIA_INSPECTION_API_DESIGN.md),
[October research](docs/MEDIA_INSPECTION_API_RESEARCH_2026_10.md) and
[outcome](docs/MEDIA_INSPECTION_API_OUTCOME.md) for evidence and remaining scope.

Owned media workload diagnostics can separate seventeen fixed transport
phases with `--media-execution owned --media-diagnostics on`. Reports retain
bounded aggregate counts/durations after cleanup, excluding private command data.
Version-two snapshots distinguish bootstrap CLI/API work and hybrid summaries.
See the preceding [design](docs/MEDIA_TRANSPORT_PHASE_DESIGN.md),
[official research](docs/MEDIA_TRANSPORT_PHASE_RESEARCH_2026_10.md) and
[measured outcome](docs/MEDIA_TRANSPORT_PHASE_OUTCOME.md) before changing transport.

The explicit distinct/source workload supports `--media-execution owned` for one
scenario-owned read-only ffprobe container. Every inspection still executes;
generation keeps per-command isolation. Per-command remains the default during
this pilot. See the [design](docs/OWNED_MEDIA_EXECUTOR_DESIGN.md),
[official research](docs/OWNED_MEDIA_EXECUTOR_RESEARCH_2026_10.md) and
[outcome](docs/OWNED_MEDIA_EXECUTOR_OUTCOME.md) for ownership, evidence and limits.

Wanted seed profiling now separates consent, generated/inspected media, actual
apply and receipt verification with bounded private-data-free phase records.
Distinct fixtures retain the actual worker preview and avoid a redundant earlier
preview; `--seed-preview separate` keeps the conservative comparator. See the
[design](docs/WANTED_SEED_PHASE_DESIGN.md),
[research](docs/WANTED_SEED_PHASE_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_SEED_PHASE_OUTCOME.md). Canonical verification remains.

Guarded workload commands support explicit reviewed selections and safe failure
locations. The full default matrix is unchanged; selected artifacts record their
smaller scope. For focused source comparison use
`node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> --source-noops --profiles sine --bindings 2 --pairs 1`.
Verify local ffmpeg/ffprobe or configure a verified local media image first.
See the [replay design](docs/WANTED_WORKLOAD_REPLAY_DESIGN.md),
[research](docs/WANTED_WORKLOAD_REPLAY_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_WORKLOAD_REPLAY_OUTCOME.md).

Fresh default PostgreSQL 18 test fixtures can capture a bounded server startup
window for the original unnamed cold client. Private marker/session association
keeps raw identities out of output; early unassociated receipts remain unknown.
See the [design](docs/POSTGRES_STARTUP_SERVER_DESIGN.md),
[research](docs/POSTGRES_STARTUP_SERVER_RESEARCH_2026_10.md) and
[outcome](docs/POSTGRES_STARTUP_SERVER_OUTCOME.md). Production configuration and
fixture connection deadlines remain unchanged.

Canonical Wanted can skip a source transition only after a live owned row lock
proves that an available source is already existing. Actual writes/events and
the final complete verification remain guarded. See the
[design](docs/WANTED_SOURCE_NOOP_DESIGN.md),
[research](docs/WANTED_SOURCE_NOOP_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_SOURCE_NOOP_OUTCOME.md). Compare against compatibility with
`node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> --source-noops`.

The explicit guarded workload now measures 2/4/8 distinct private files and
saved requirements with fixed receipt history. Run
`node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> --distinct-bindings`.
See the [design](docs/WANTED_DISTINCT_BINDING_PROFILE_DESIGN.md),
[official research](docs/WANTED_DISTINCT_BINDING_PROFILE_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_DISTINCT_BINDING_PROFILE_OUTCOME.md). Per-source guards grow
full projection/hash work in compatibility mode; this profile preserves them.

Owned fixture checkout diagnostics now capture the original cold client's
transport/startup milestones and a private target-match result. See the
[design](docs/POSTGRES_CONNECTION_BOUNDARY_DESIGN.md),
[official research](docs/POSTGRES_CONNECTION_BOUNDARY_RESEARCH_2026_10.md) and
[outcome](docs/POSTGRES_CONNECTION_BOUNDARY_OUTCOME.md). Resource limits remain;
the original uninstrumented failure retains its unknown cause.

Wanted publication can resolve each eligible closed receipt group's current
root once before each full hash, using proved transaction-bound authority.
Standalone/custom paths retain independent roots. See the
[design](docs/WANTED_BOUNDED_ROOT_READ_DESIGN.md),
[official research](docs/WANTED_BOUNDED_ROOT_READ_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_BOUNDED_ROOT_READ_OUTCOME.md). The explicit
`--bounded-roots` benchmark compares exact outcomes and identical hash/byte work.

Root-input database writers now join Wanted's existing transaction-wide
publication lock before tuple mutation. See the
[design](docs/WANTED_ROOT_AUTHORITY_COORDINATION_DESIGN.md),
[official research](docs/WANTED_ROOT_AUTHORITY_COORDINATION_RESEARCH_2026_10.md)
and [outcome](docs/WANTED_ROOT_AUTHORITY_COORDINATION_OUTCOME.md) for current
revocation semantics, settings contention, enabled schema anchors and native
proof. Every current root read and both full content hashes remain.

Opt-in Wanted root-cost profiling separates root SQL from broader root-resolution
work and records fixed process-memory windows. See the
[design](docs/WANTED_ROOT_COST_PROFILE_DESIGN.md),
[official research](docs/WANTED_ROOT_COST_PROFILE_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_ROOT_COST_PROFILE_OUTCOME.md). Run it explicitly with
`node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> --root-costs`;
its matched controls preserve every current authorization read and both hashes.

Harmoniarr is being planned as a self-hosted FOSS application with no SLA or operational warranty. The docs in this repository describe intended behavior and design direction, not a hosted-service support commitment.

For development, run the focused tests for the changed domain, then
`npm run validate:fast` for static checks, unit tests and builds. Database changes
also need their affected PostgreSQL tests. Run `npm run validate` for the complete
serial gate; `npm run test:integration:serial` runs its database layer explicitly.
The two-worker experiment exposed a recovery failure and was not promoted. See the
[efficiency design](docs/TEST_EXECUTION_EFFICIENCY_DESIGN.md),
[measured outcome](docs/TEST_EXECUTION_EFFICIENCY_OUTCOME.md) and
[official research](docs/TEST_EXECUTION_EFFICIENCY_RESEARCH_2026_10.md).

Serial integration now includes a bounded early failure reporter alongside native
output. Set `HARMONIARR_INTEGRATION_PHASE_TIMINGS=1` to collect safe setup/work/
cleanup durations. See the [fixture design](docs/TEST_FIXTURE_OBSERVABILITY_DESIGN.md),
[outcome](docs/TEST_FIXTURE_OBSERVABILITY_OUTCOME.md) and
[research](docs/TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md).

Direct PostgreSQL and app fixtures now apply one explicit pool policy. Native
failure evidence also captures bounded state from the exact owned fresh
container, alongside independent query/readiness observations. See the
[reset investigation design](docs/POSTGRES_FIXTURE_RESET_DESIGN.md),
[research](docs/POSTGRES_FIXTURE_RESET_RESEARCH_2026_10.md) and
[outcome](docs/POSTGRES_FIXTURE_RESET_OUTCOME.md) for checkpoint drainage,
controlled failure proof and the limits of connection-reset diagnosis.

Wanted now explicitly selects a migration-only template in its per-file runtime;
every variant still receives a fresh database and pool. Other suites keep their
existing preparation paths. Set `HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE=empty`
for the unchanged preparation profile, or `migration_template` for the selected
profile. See the [template design](docs/POSTGRES_TEST_TEMPLATES_DESIGN.md),
[outcome](docs/POSTGRES_TEST_TEMPLATES_OUTCOME.md) and
[official research](docs/POSTGRES_TEST_TEMPLATES_RESEARCH_2026_10.md).

`npm run test:integration:shared-postgres` runs the verified Wanted/catalogue/
release-reconciliation/tag-snapshot/Music Queue recovery transaction cohort
serially against one newly owned PostgreSQL server, with separate file
processes and scenario databases. The complete gate remains unchanged. See the
[launcher design](docs/POSTGRES_TEST_LAUNCHER_DESIGN.md),
[measured outcome](docs/POSTGRES_TEST_LAUNCHER_OUTCOME.md) and
[official research](docs/POSTGRES_TEST_LAUNCHER_RESEARCH_2026_10.md).
The [Wanted/recovery pilot design](docs/WANTED_RECOVERY_SHARED_POSTGRES_DESIGN.md),
[research](docs/WANTED_RECOVERY_SHARED_POSTGRES_RESEARCH_2026_10.md) and
[outcome](docs/WANTED_RECOVERY_SHARED_POSTGRES_OUTCOME.md) record matched local
measurement, actual completion ownership and parent-owned failure snapshots.
To run only this audited pair, use
`npm run test:integration:shared-postgres -- test/integration/library-wanted-release-reconciliation.test.js test/integration/music-queue-recovery-transaction.test.js`.
The [audited extension design](docs/SHARED_POSTGRES_COHORT_ADOPTION_DESIGN.md),
[outcome](docs/SHARED_POSTGRES_COHORT_ADOPTION_OUTCOME.md) and
[research](docs/SHARED_POSTGRES_COHORT_ADOPTION_RESEARCH_2026_10.md) record worker,
transaction/media drainage and the matched-order 34-case profile.

Release reconciliation and tag snapshots now select private migration-only
templates, retaining fresh scenario databases/pools/seeds and actual idempotent
migration calls. Set `HARMONIARR_INTEGRATION_RELEASE_SCHEMA_MODE=empty` or
`HARMONIARR_INTEGRATION_TAG_SCHEMA_MODE=empty` for their comparison paths.
The global runtime remains empty; dedicated migration/bootstrap/
recovery paths keep their own preparation. See the
[schema design](docs/LIBRARY_TEST_SCHEMA_TEMPLATES_DESIGN.md),
[measured outcome](docs/LIBRARY_TEST_SCHEMA_TEMPLATES_OUTCOME.md) and
[official research](docs/LIBRARY_TEST_SCHEMA_TEMPLATES_RESEARCH_2026_10.md).

Catalogue now also selects a private migration-only source after its worker,
transaction, observer and workspace lifetime audit. It keeps all eight native
cases and thirteen fresh scenario variants. Use
`HARMONIARR_INTEGRATION_CATALOGUE_SCHEMA_MODE=empty` for comparison. See the
[catalogue design](docs/CATALOGUE_TEST_LIFECYCLE_DESIGN.md),
[outcome](docs/CATALOGUE_TEST_LIFECYCLE_OUTCOME.md) and
[official research](docs/CATALOGUE_TEST_LIFECYCLE_RESEARCH_2026_10.md).

- [Planning document](docs/harmoniarr.md)
- [Reusable fingerprint design](docs/TRACK_FINGERPRINT_REUSABLE_DESIGN.md), [official research](docs/TRACK_FINGERPRINT_REUSABLE_RESEARCH_2026_10.md) and [outcome](docs/TRACK_FINGERPRINT_REUSABLE_OUTCOME.md)
- [Guarded Wanted workload design](docs/WANTED_GUARDED_WORKLOAD_DESIGN.md), [official research](docs/WANTED_GUARDED_WORKLOAD_RESEARCH_2026_10.md) and [outcome](docs/WANTED_GUARDED_WORKLOAD_OUTCOME.md)
- [Closed receipt group design](docs/WANTED_CLOSED_RECEIPT_GROUP_DESIGN.md), [official research](docs/WANTED_CLOSED_RECEIPT_GROUP_RESEARCH_2026_10.md) and [outcome](docs/WANTED_CLOSED_RECEIPT_GROUP_OUTCOME.md)
- [PostgreSQL checkout capture design](docs/POSTGRES_CHECKOUT_CAPTURE_DESIGN.md), [official research](docs/POSTGRES_CHECKOUT_CAPTURE_RESEARCH_2026_10.md) and [outcome](docs/POSTGRES_CHECKOUT_CAPTURE_OUTCOME.md)
- [Track fingerprint stream design](docs/TRACK_FINGERPRINT_STREAM_DESIGN.md), [official research](docs/TRACK_FINGERPRINT_STREAM_RESEARCH_2026_10.md) and [outcome](docs/TRACK_FINGERPRINT_STREAM_OUTCOME.md)
- [Wanted root lookup design](docs/WANTED_ROOT_LOOKUP_DESIGN.md), [official research](docs/WANTED_ROOT_LOOKUP_RESEARCH_2026_10.md) and [outcome](docs/WANTED_ROOT_LOOKUP_OUTCOME.md)
- [Wanted receipt verification design](docs/WANTED_RECEIPT_VERIFICATION_DESIGN.md), [official research](docs/WANTED_RECEIPT_VERIFICATION_RESEARCH_2026_10.md) and [outcome](docs/WANTED_RECEIPT_VERIFICATION_OUTCOME.md)
- [Scan receipt invalidation design](docs/SCAN_RECEIPT_INVALIDATION_DESIGN.md), [official research](docs/SCAN_RECEIPT_INVALIDATION_RESEARCH_2026_10.md) and [outcome](docs/SCAN_RECEIPT_INVALIDATION_OUTCOME.md)
- [Indexed owner receipt design](docs/OPERATOR_TRACK_RECEIPT_LEDGER_DESIGN.md), [official research](docs/OPERATOR_TRACK_RECEIPT_LEDGER_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_RECEIPT_LEDGER_OUTCOME.md)
- [Two-owner delivery recovery design](docs/OPERATOR_TRACK_RECOVERY_DESIGN.md), [official research](docs/OPERATOR_TRACK_RECOVERY_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_RECOVERY_OUTCOME.md)
- [AI workflow and shared Copilot skills](docs/AI_WORKFLOW.md)
- [Docker deployment baseline](docs/DOCKER_DEPLOYMENT.md)
- [Local Docker walkthrough](docs/LOCAL_DOCKER_WALKTHROUGH.md)
- [First app-checkout diagnostics design](docs/APP_FIXTURE_CHECKOUT_DIAGNOSTICS_DESIGN.md), [research](docs/APP_FIXTURE_CHECKOUT_DIAGNOSTICS_RESEARCH_2026_10.md) and [outcome](docs/APP_FIXTURE_CHECKOUT_DIAGNOSTICS_OUTCOME.md)
- [Database pool shutdown design](docs/DATABASE_POOL_SHUTDOWN_DESIGN.md), [research](docs/DATABASE_POOL_SHUTDOWN_RESEARCH_2026_10.md) and [outcome](docs/DATABASE_POOL_SHUTDOWN_OUTCOME.md)
- [Apply worker lifetime design](docs/APPLY_WORKER_LIFETIME_DESIGN.md), [research](docs/APPLY_WORKER_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/APPLY_WORKER_LIFETIME_OUTCOME.md)
- [Owned PostgreSQL failure evidence design](docs/POSTGRES_FAILURE_EVIDENCE_DESIGN.md), [research](docs/POSTGRES_FAILURE_EVIDENCE_RESEARCH_2026_10.md) and [outcome](docs/POSTGRES_FAILURE_EVIDENCE_OUTCOME.md)
- [Dispatcher lifetime design](docs/DISPATCHER_LIFETIME_DESIGN.md), [research](docs/DISPATCHER_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/DISPATCHER_LIFETIME_OUTCOME.md)
- [Library scan lifetime design](docs/LIBRARY_SCAN_LIFETIME_DESIGN.md), [research](docs/LIBRARY_SCAN_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/LIBRARY_SCAN_LIFETIME_OUTCOME.md)
- [Import execution lifetime design](docs/IMPORT_EXECUTION_LIFETIME_DESIGN.md), [research](docs/IMPORT_EXECUTION_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/IMPORT_EXECUTION_LIFETIME_OUTCOME.md)
- [Media inspection lifetime design](docs/MEDIA_INSPECTION_LIFETIME_DESIGN.md), [research](docs/MEDIA_INSPECTION_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/MEDIA_INSPECTION_LIFETIME_OUTCOME.md)
- [Transcode orchestration lifetime design](docs/TRANSCODE_LIFETIME_DESIGN.md), [research](docs/TRANSCODE_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/TRANSCODE_LIFETIME_OUTCOME.md)
- [Library organize apply lifetime design](docs/ORGANIZE_APPLY_LIFETIME_DESIGN.md), [research](docs/ORGANIZE_APPLY_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/ORGANIZE_APPLY_LIFETIME_OUTCOME.md)
- [Library discovery dispatch lifetime design](docs/DISCOVERY_DISPATCH_LIFETIME_DESIGN.md), [research](docs/DISCOVERY_DISPATCH_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/DISCOVERY_DISPATCH_LIFETIME_OUTCOME.md)
- [External intake planning lifetime design](docs/EXTERNAL_INTAKE_LIFETIME_DESIGN.md), [research](docs/EXTERNAL_INTAKE_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/EXTERNAL_INTAKE_LIFETIME_OUTCOME.md)
- [Provider ingest execution lifetime design](docs/PROVIDER_INGEST_LIFETIME_DESIGN.md), [research](docs/PROVIDER_INGEST_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/PROVIDER_INGEST_LIFETIME_OUTCOME.md)
- [External request discovery lifetime design](docs/EXTERNAL_REQUEST_DISCOVERY_LIFETIME_DESIGN.md), [research](docs/EXTERNAL_REQUEST_DISCOVERY_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/EXTERNAL_REQUEST_DISCOVERY_LIFETIME_OUTCOME.md)
- [Metadata artist refresh lifetime design](docs/METADATA_ARTIST_REFRESH_LIFETIME_DESIGN.md), [research](docs/METADATA_ARTIST_REFRESH_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/METADATA_ARTIST_REFRESH_LIFETIME_OUTCOME.md)
- [Operator artist reconciliation lifetime design](docs/OPERATOR_ARTIST_RECONCILIATION_LIFETIME_DESIGN.md), [research](docs/OPERATOR_ARTIST_RECONCILIATION_LIFETIME_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_ARTIST_RECONCILIATION_LIFETIME_OUTCOME.md)
- [Operator reconciliation publication authority design](docs/OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_DESIGN.md), [research](docs/OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_OUTCOME.md)
- [Metadata source writer coordination design](docs/METADATA_SOURCE_WRITER_COORDINATION_DESIGN.md), [research](docs/METADATA_SOURCE_WRITER_COORDINATION_RESEARCH_2026_10.md) and [outcome](docs/METADATA_SOURCE_WRITER_COORDINATION_OUTCOME.md)
- [Operator monitoring opt-out design](docs/OPERATOR_MONITORING_OPT_OUT_DESIGN.md), [research](docs/OPERATOR_MONITORING_OPT_OUT_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_MONITORING_OPT_OUT_OUTCOME.md)
- [Operator track consent design](docs/OPERATOR_TRACK_CONSENT_DESIGN.md), [research](docs/OPERATOR_TRACK_CONSENT_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_CONSENT_OUTCOME.md)
- [Verified operator track requirements design](docs/OPERATOR_TRACK_CATALOG_DESIGN.md), [research](docs/OPERATOR_TRACK_CATALOG_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_CATALOG_OUTCOME.md)
- [Exact single-track acquisition design](docs/OPERATOR_TRACK_SUBSET_DESIGN.md), [research](docs/OPERATOR_TRACK_SUBSET_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_SUBSET_OUTCOME.md)
- [Two-owner track delivery design](docs/OPERATOR_TRACK_UNION_DESIGN.md), [research](docs/OPERATOR_TRACK_UNION_RESEARCH_2026_10.md) and [outcome](docs/OPERATOR_TRACK_UNION_OUTCOME.md)
- [Downloader filter feedback design](docs/DOWNLOADER_FILTER_ANNOUNCEMENT_DESIGN.md), [research](docs/DOWNLOADER_FILTER_ANNOUNCEMENT_RESEARCH_2026_10.md) and [outcome](docs/DOWNLOADER_FILTER_ANNOUNCEMENT_OUTCOME.md)
- [No-cache local rebuild design](docs/LOCAL_DOCKER_REBUILD_2026_10_DESIGN.md), [official research](docs/LOCAL_DOCKER_REBUILD_RESEARCH_2026_10.md) and [outcome](docs/LOCAL_DOCKER_REBUILD_2026_10_OUTCOME.md)
- [Backup, restore, and upgrade design](docs/BACKUP_RESTORE_DESIGN.md)
- [Bootstrap-admin recovery runbook](docs/ADMIN_RECOVERY_RUNBOOK.md)
- [Security policy and posture](docs/SECURITY_POLICY.md)
- [Security benchmarks](docs/SECURITY_BENCHMARKS.md)
- [Release checklist](release.md)
- [External request discovery design and tradeoffs](docs/EXTERNAL_REQUEST_DISCOVERY_HANDOFF_DESIGN.md)
- [External request discovery outcome and next step](docs/EXTERNAL_REQUEST_DISCOVERY_HANDOFF_OUTCOME.md)
- [External collection design, sources, and tradeoffs](docs/EXTERNAL_COLLECTION_COMPLETION_DESIGN.md)
- [External collection outcome and release follow-up](docs/EXTERNAL_COLLECTION_COMPLETION_OUTCOME.md)
- [Provider access research, design, and tradeoffs](docs/PROVIDER_ACCESS_ACCEPTANCE_DESIGN.md)
- [Provider access outcome and acceptance runbook](docs/PROVIDER_ACCESS_ACCEPTANCE_OUTCOME.md)
- [PostgreSQL recovery research, design, and tradeoffs](docs/POSTGRES_RECOVERY_REHEARSAL_DESIGN.md)
- [PostgreSQL recovery outcome and next release work](docs/POSTGRES_RECOVERY_REHEARSAL_OUTCOME.md)
- [Missing Music pagination and preparation design](docs/MUSIC_QUEUE_PAGINATION_DESIGN.md)
- [Missing Music pagination outcome and release follow-up](docs/MUSIC_QUEUE_PAGINATION_OUTCOME.md)
- [Immutable candidate acceptance design](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_DESIGN.md)
- [Immutable candidate acceptance outcome and next release work](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_OUTCOME.md)
- [Request lifecycle Activity design](docs/REQUEST_LIFECYCLE_ACTIVITY_DESIGN.md)
- [Request lifecycle Activity outcome and recommendations](docs/REQUEST_LIFECYCLE_ACTIVITY_OUTCOME.md)
- [Transactional request lifecycle design](docs/TRANSACTIONAL_REQUEST_LIFECYCLE_DESIGN.md)
- [Transactional request lifecycle outcome](docs/TRANSACTIONAL_REQUEST_LIFECYCLE_OUTCOME.md)
- [Recipient eligibility consistency design](docs/RECIPIENT_ELIGIBILITY_CONSISTENCY_DESIGN.md)
- [Recipient eligibility consistency outcome](docs/RECIPIENT_ELIGIBILITY_CONSISTENCY_OUTCOME.md)
- [Published candidate trust design](docs/PUBLISHED_CANDIDATE_TRUST_DESIGN.md)
- [Published candidate trust outcome](docs/PUBLISHED_CANDIDATE_TRUST_OUTCOME.md)
- [Release provenance gate design](docs/RELEASE_PROVENANCE_GATE_DESIGN.md)
- [Release provenance gate outcome and next priorities](docs/RELEASE_PROVENANCE_GATE_OUTCOME.md)
- [Draft-first release lifecycle design](docs/DRAFT_RELEASE_LIFECYCLE_DESIGN.md)
- [Draft-first release lifecycle outcome](docs/DRAFT_RELEASE_LIFECYCLE_OUTCOME.md)
- [Candidate staging and tag promotion design](docs/RELEASE_TAG_PROMOTION_DESIGN.md)
- [Candidate staging and tag promotion outcome](docs/RELEASE_TAG_PROMOTION_OUTCOME.md)
- [Local workflow-script replay](docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md)
- [Missing Music Search again design](docs/MISSING_MUSIC_SEARCH_AGAIN_DESIGN.md)
- [Missing Music Search again outcome](docs/MISSING_MUSIC_SEARCH_AGAIN_OUTCOME.md)
- [Missing Music quality fallback design](docs/MISSING_MUSIC_QUALITY_FALLBACK_DESIGN.md)
- [Missing Music quality fallback outcome](docs/MISSING_MUSIC_QUALITY_FALLBACK_OUTCOME.md)
- [Missing Music Find matches design](docs/MISSING_MUSIC_FIND_MATCHES_DESIGN.md)
- [Missing Music Find matches outcome](docs/MISSING_MUSIC_FIND_MATCHES_OUTCOME.md)
- [Missing Music library-add recheck design](docs/MISSING_MUSIC_LIBRARY_ADD_RECHECK_DESIGN.md)
- [Missing Music library-add recheck outcome](docs/MISSING_MUSIC_LIBRARY_ADD_RECHECK_OUTCOME.md)
- [Missing Music Add to library design](docs/MISSING_MUSIC_ADD_TO_LIBRARY_DESIGN.md)
- [Missing Music Add to library outcome](docs/MISSING_MUSIC_ADD_TO_LIBRARY_OUTCOME.md)
- [Add to library open PR applicability design](docs/OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_DESIGN.md)
- [Add to library open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ADD_TO_LIBRARY_2026_10_OUTCOME.md)
- [Automatic library-add guard design](docs/MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_DESIGN.md)
- [Automatic library-add guard outcome](docs/MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_OUTCOME.md)
- [Fallback recovery guard design](docs/MUSIC_QUEUE_FALLBACK_RECOVERY_DESIGN.md)
- [Fallback recovery guard outcome](docs/MUSIC_QUEUE_FALLBACK_RECOVERY_OUTCOME.md)
- [Attempt-owned download confirmation design](docs/DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md)
- [Attempt-owned download confirmation outcome](docs/DOWNLOAD_HANDOFF_CONFIRMATION_OUTCOME.md)
- [slskd transfer contract research](docs/SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md)
- [Batch download handoff design and recommendation stack](docs/BATCH_DOWNLOAD_HANDOFF_DESIGN.md)
- [Batch download handoff and operator adoption outcome](docs/BATCH_DOWNLOAD_HANDOFF_OUTCOME.md)
- [slskd batch API primary-source research](docs/SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md)
- [Guarded download origin resolution design](docs/DOWNLOAD_ORIGIN_RESOLUTION_DESIGN.md)
- [Guarded download origin resolution outcome](docs/DOWNLOAD_ORIGIN_RESOLUTION_OUTCOME.md)
- [Origin resolution official research](docs/ORIGIN_RESOLUTION_RESEARCH_2026_10.md)
- [Current-owned wanted-release replacement design](docs/WANTED_RELEASE_RECONCILIATION_DESIGN.md)
- [Wanted-release outcome and next recommendation](docs/WANTED_RELEASE_RECONCILIATION_OUTCOME.md)
- [Wanted-release official research](docs/WANTED_RELEASE_RECONCILIATION_RESEARCH_2026_10.md)
- [Wanted-release open PR applicability design](docs/OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_DESIGN.md)
- [Wanted-release open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_OUTCOME.md)
- [Acquisition-owned release reconciliation design](docs/RELEASE_RECONCILIATION_DESIGN.md)
- [Release reconciliation outcome and next recommendation](docs/RELEASE_RECONCILIATION_OUTCOME.md)
- [Release reconciliation official research](docs/RELEASE_RECONCILIATION_RESEARCH_2026_10.md)
- [Release reconciliation open PR applicability design](docs/OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_DESIGN.md)
- [Release reconciliation open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_OUTCOME.md)
- [Acquisition-owned file-match design](docs/FILE_MATCH_DESIGN.md)
- [File-match outcome and next recommendation](docs/FILE_MATCH_OUTCOME.md)
- [File-match official research](docs/FILE_MATCH_RESEARCH_2026_10.md)
- [File-match open PR applicability design](docs/OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_DESIGN.md)
- [File-match open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_OUTCOME.md)
- [Acquisition-owned tag snapshot design](docs/TAG_SNAPSHOT_DESIGN.md)
- [Tag snapshot outcome and next recommendation](docs/TAG_SNAPSHOT_OUTCOME.md)
- [Tag snapshot official research](docs/TAG_SNAPSHOT_RESEARCH_2026_10.md)
- [Tag snapshot open PR applicability design](docs/OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_DESIGN.md)
- [Tag snapshot open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_OUTCOME.md)
- [Acquisition-owned scan catalogue design](docs/SCAN_CATALOGUE_DESIGN.md)
- [Scan catalogue outcome and next recommendation](docs/SCAN_CATALOGUE_OUTCOME.md)
- [Scan catalogue official research](docs/SCAN_CATALOGUE_RESEARCH_2026_10.md)
- [Scan catalogue open PR applicability design](docs/OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_DESIGN.md)
- [Scan catalogue open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_OUTCOME.md)
- [Guarded library-organize mutation design](docs/ORGANIZE_MUTATION_DESIGN.md)
- [Guarded library-organize mutation outcome](docs/ORGANIZE_MUTATION_OUTCOME.md)
- [Organize mutation official research](docs/ORGANIZE_MUTATION_RESEARCH_2026_10.md)
- [Organize mutation PR applicability design](docs/OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_DESIGN.md)
- [Organize mutation PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_OUTCOME.md)
- [Lease acquisition fencing design](docs/LEASE_ACQUISITION_DESIGN.md)
- [Lease acquisition fencing outcome](docs/LEASE_ACQUISITION_OUTCOME.md)
- [Lease acquisition official research](docs/LEASE_ACQUISITION_RESEARCH_2026_10.md)
- [Lease acquisition PR applicability design](docs/OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_DESIGN.md)
- [Lease acquisition PR applicability outcome](docs/OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_OUTCOME.md)
- [Guarded abandoned preparation closure design](docs/ABANDONED_PREPARATION_DESIGN.md)
- [Guarded abandoned preparation closure outcome](docs/ABANDONED_PREPARATION_OUTCOME.md)
- [Abandoned preparation official research](docs/ABANDONED_PREPARATION_RESEARCH_2026_10.md)
- [Abandoned preparation PR applicability design](docs/OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_DESIGN.md)
- [Abandoned preparation PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ABANDONED_PREPARATION_2026_10_OUTCOME.md)
- [Explicit pre-provider refusal design](docs/PRE_PROVIDER_REFUSAL_DESIGN.md)
- [Explicit pre-provider refusal outcome](docs/PRE_PROVIDER_REFUSAL_OUTCOME.md)
- [Pre-provider refusal official research](docs/PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md)
- [Pre-provider refusal PR applicability design](docs/OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_DESIGN.md)
- [Pre-provider refusal PR applicability outcome](docs/OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_OUTCOME.md)
- [Origin resolution open PR applicability design](docs/OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_DESIGN.md)
- [Origin resolution open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md)
- [Batch handoff open PR applicability design](docs/OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_DESIGN.md)
- [Batch handoff open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_OUTCOME.md)
- [Music metadata security update design](docs/MUSIC_METADATA_SECURITY_UPDATE_2026_10_DESIGN.md)
- [Music metadata security update outcome](docs/MUSIC_METADATA_SECURITY_UPDATE_2026_10_OUTCOME.md)
- [Fallback recovery open PR applicability design](docs/OPEN_PR_APPLICABILITY_RECOVERY_2026_10_DESIGN.md)
- [Fallback recovery open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_RECOVERY_2026_10_OUTCOME.md)
- [Automatic library-add open PR applicability design](docs/OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_DESIGN.md)
- [Automatic library-add open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_AUTOMATIC_ADD_2026_10_OUTCOME.md)
- [October 8 dependency security design](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_08_DESIGN.md)
- [October 8 dependency security outcome](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_08_OUTCOME.md)
- [Open PR applicability design](docs/OPEN_PR_APPLICABILITY_2026_10_DESIGN.md)
- [Open PR applicability outcome](docs/OPEN_PR_APPLICABILITY_2026_10_OUTCOME.md)
- [Practical web standards skill design](docs/WEB_STANDARDS_SKILL_DESIGN.md)
- [Practical web standards skill outcome](docs/WEB_STANDARDS_SKILL_OUTCOME.md)
- [Random PR #24 local replay design](docs/RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md)
- [Random PR #24 local replay outcome](docs/RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md)
- [Scoped policy overrides skill design](docs/SCOPED_POLICY_OVERRIDES_SKILL_DESIGN.md)
- [Scoped policy overrides skill outcome](docs/SCOPED_POLICY_OVERRIDES_SKILL_OUTCOME.md)
- [Node runtime patch design](docs/NODE_RUNTIME_PATCH_2026_10_DESIGN.md)
- [Node runtime patch outcome](docs/NODE_RUNTIME_PATCH_2026_10_OUTCOME.md)
- [Random PR #40 local replay design](docs/RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md)
- [Random PR #40 local replay outcome](docs/RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md)
- [Random PR #23 local replay design](docs/RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md)
- [Random PR #23 local replay outcome](docs/RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md)
- [October dependency security design](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_DESIGN.md)
- [October dependency security outcome](docs/DEPENDENCY_SECURITY_UPDATE_2026_10_OUTCOME.md)

## Current Direction

The current planning baseline includes a few explicit v1 decisions:

- Local first-run admin setup with Classifarr-style cookie-based browser auth.
- Refresh-token-backed sessions with deployment-controlled CSRF protection for cookie-authenticated writes. Release deployments should set `security.csrfProtectionMode` to `required`; an opt-out exists for tightly trusted local-only installs.
- Optional lightweight integration tokens may be added for local automation if a real use case appears, but normal browser administration remains session-based.
- Explicit path-mapping and staging boundaries between `slskd`, Harmoniarr, and final library roots.
- Staging-first treatment of completed Soulseek downloads before import into the library.

## Deployment Baseline

The repository now includes the deployment scaffolding for the planned standard container layout:

- `Dockerfile`
- `docker/entrypoint.sh`
- `compose.yaml`
- `compose.walkthrough.yaml`
- `compose.slskd-example.yaml`
- `.env.example`

The application builds and boots with embedded PostgreSQL, tracked SQL migrations, an Express API, and a Vue client on port `3000`. `/healthz` supports smoke validation. Library management, acquisition review, and recovery are implemented; the platform remains under validation toward its first supported release.

External artist and playlist requests use bounded provider preparation and explicit collection review. Administrators include local release editions or exclude captured items with a reason, then finalize the selection. Fulfillment requires imports for every distinct included release belonging to the request target.

The planned container target is 64-bit only. The current baseline should support `amd64` and `arm64`; 32-bit targets are not part of the supported runtime posture.

Recommended host path layout:

```text
/srv/harmoniarr
/srv/slskd/downloads
/srv/slskd/config
/srv/media/music
/srv/harmoniarr/staging
/srv/harmoniarr/transcode-temp
```

Recommended first-run `.env` values:

```text
TZ=UTC
PUID=1000
PGID=1000
UMASK=0022
APP_PORT=3000
HARMONIARR_PORT=47956
HARMONIARR_CONTACT_URL=https://github.com/cloudbyday90/harmoniarr
HARMONIARR_CONTACT_EMAIL=
HARMONIARR_CSRF_PROTECTION=required
HARMONIARR_APPDATA=/srv/harmoniarr
HARMONIARR_DOWNLOADS=/srv/slskd/downloads
HARMONIARR_MUSIC=/srv/media/music
HARMONIARR_STAGING=/srv/harmoniarr/staging
HARMONIARR_TRANSCODE_TEMP=/srv/harmoniarr/transcode-temp
SLSKD_BASE_URL=http://slskd:5030
SLSKD_WEB_PORT=5030
SLSKD_APPDATA=/srv/slskd/config
```

`HARMONIARR_CSRF_PROTECTION` defaults to `required`. Set it to `disabled` only for tightly trusted local-only or separately network-restricted deployments where you are intentionally accepting the CSRF tradeoff. A reverse proxy can reduce exposure and enforce network boundaries, but it is not a general substitute for CSRF protection by itself.

`PUID` and `PGID` now select the container user through Compose itself. Ensure the bound host paths are writable by that UID/GID pair; the default runtime path no longer tries to `chown` host mounts during startup.

The default Compose baselines now also run with a read-only container root filesystem. Writable state is limited to the explicit bind mounts and tmpfs mounts declared in the Compose files.

The checked-in Compose baselines also avoid floating image aliases. The Harmoniarr build tag is pinned to `0.1.0-beta`, and the side-by-side `slskd` example is pinned to `slskd/slskd:0.25.1` so version bumps stay reviewable instead of inheriting `latest` drift.

Repository security scanning now runs through a dedicated GitHub Actions workflow that combines the local `npm audit` policy, OSV dependency scanning, Trivy config scanning, and Trivy-backed secret scanning.

Repository supply-chain metadata now also runs through a separate GitHub Actions workflow that builds the current distributable outputs, generates an SPDX SBOM, submits a dependency snapshot to GitHub, and emits build-provenance attestations for public-repo runs.

Release publication now has its own GitHub Actions workflow as well. Published GitHub releases build and push a multi-architecture GHCR image plus a Docker Hub mirror when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured in GitHub, capture the canonical GHCR digest, publish an SPDX SBOM as a release asset, and attach a short verification note with the exact `oci://...@sha256:...` reference and attestation-check commands.

That release workflow now also performs a post-publish smoke check against the immutable GHCR digest itself, not just against a local build, verifies the published release contract against the actual GitHub release assets, and publishes both a machine-readable `harmoniarr-release-metadata.json` asset and a ready-to-use `harmoniarr-release-compose.override.yaml` override for immutable deployments.

GHCR is the canonical trust boundary for release verification and attestation checks by default. Docker Hub remains an optional runtime mirror that is verified for tag coverage and digest parity unless the release workflow is explicitly configured with `DOCKERHUB_TRUSTED_MIRROR=true`, in which case the workflow also promotes copied OCI referrers through ORAS and verifies the discovered referrer graph against GHCR.

Outdated images are now handled separately through the scheduled `Container Image Maintenance` workflow. It deletes stale untagged GHCR package versions, and on Docker Hub it keeps `latest` plus the newest five non-protected tags by `last_updated` unless you override that retention on a manual run.

The checked-in Compose files stay on explicit version tags because those references are reviewable before a release exists. Once a release image is published, deployment-specific Compose files should prefer a fully qualified `tag@sha256:digest` reference so the running artifact is immutable as well as human-readable.

Operators who want a release-aligned Compose override can download the published `harmoniarr-release-compose.override.yaml` asset instead of hand-transcribing the digest from prose notes.

Docker defaults `HARMONIARR_CONTACT_URL` to the project URL so the baseline container can start with MusicBrainz enabled. Override it with your own project or operator contact URL, or set `HARMONIARR_CONTACT_EMAIL` instead, if you need a deployment-specific `User-Agent`.

If you want Harmoniarr and `slskd` side by side, start from `compose.slskd-example.yaml` and keep `/data/downloads` identical inside both containers.

If you want a disposable localhost-only walkthrough with a ready-made admin login, use `compose.walkthrough.yaml` and the explicit one-shot bootstrap flow documented in `docs/LOCAL_DOCKER_WALKTHROUGH.md`.

The Docker build context is trimmed with `.dockerignore` so docs, git metadata, logs, and local dependency trees do not get sent into routine image builds.

## License

Harmoniarr is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [COPYRIGHT.md](COPYRIGHT.md).
