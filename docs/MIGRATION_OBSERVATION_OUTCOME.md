# Migration observation outcome

October 26, 2026. Implements the next item from
[readiness diagnostics](READINESS_DIAGNOSTICS_OUTCOME.md).
See separate [research and tradeoffs](MIGRATION_OBSERVATION_RESEARCH.md),
[design](MIGRATION_OBSERVATION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_MIGRATION_OBSERVATION_OUTCOME.md).

Onboarding summary, backup export and restore preview now default to the existing
readMigrationStatus service. Together with system overview, these HTTP service
consumers read prepared migration state without replacing functions or creating
schema objects. Their injectable dependency and migration-count data contract
remain stable. No new production service, pool, schema object or deployment is
introduced. Startup/CLI preparation and fatal startup checks remain unchanged.

Onboarding and restore-preview administrator GET responses now carry no-store.
Authorization remains before the service call. Backup creation and restore apply
retain their existing fresh-admin/CSRF/idempotency and current-state contracts.
The export command still writes artifacts and audit/journal state; only its
migration observation becomes read-only. No client rendering or copy changed.

The focused service/route cohort passed 51 checks. The final stable gate passed
6,131 server, 4,491 client and 700 script tests, plus lint, copyright, migration/
schema, ESM, image-tag, Compose and build checks. The gate was repeated after
extending the native qualification with an actual restore-apply control. Runtime
npm audit reported zero vulnerabilities and no dependencies were changed.

The guarded packaged preflight installed a fixture-only DDL refusal trigger on
disposable PostgreSQL. Its negative control rejected the legacy preparing helper
with 25006. The new reader worked in an actual READ ONLY transaction, and production
service defaults supported twenty concurrent onboarding/preview reads with an
overlapping backup command. Three encrypted files, manifest migration levels and
payload hashes were verified. Idempotent replay reused the original artifact;
pending schema blocked restore compatibility while export retained pending:1.
Actual restore apply completed and restored settings under the same DDL guard.
Missing schema was not repaired, the UUID-function catalog identity remained
unchanged and the expected audit/journal rows were verified. Unauthenticated,
requester and missing-CSRF controls retained their refusal behavior.

An additional Windows-hosted auth/settings/recovery integration file passed three
of four cases; backup creation returned HTTP 500. A bounded diagnostic copy exposed
EPERM from fsync. An owned Windows probe confirmed that file fsync succeeded while
directory fsync failed with EPERM. This failed host run and its diagnostics remain
recorded; it is not a passing integration cohort. Native Linux qualification keeps
the required directory checkpoints and verifies actual export/restore behavior.
No Windows durability fallback or timeout/retry workaround was added.

The final immutable no-cache image passed the complete guarded observation test,
including its restore-apply control, without source overlays. The packaged normal
startup/recovery regression also passed with production background services enabled.
Both disposable containers were removed and absence verified. The live packaged
onboarding page returned a current database step and no-store, retained Refresh
focus and fit a 390 px viewport. Screenshots were inspected; manual screen-reader
and physical-device checks remain deferred.

Exact runtime comparison found only the four intended server files changed. All
other server code, shared files, all client assets, runtime npm/OS dependencies
and six mapped native binary hashes matched the preceding committed image.
Unchanged readiness-fault, backup filesystem/process/SQL/container crash, worker
interruption and media/codec qualification retain their preceding evidence; those
matrices were not rerun as new results. The changed service composition has fresh
native proof. The walkthrough's existing data and all five real mounts were retained.

The native fixture uses controlled provider-status replies and real application,
database, authorization, encryption and filesystem work. Background services are
disabled for the focused journey; the separate normal-startup regression owns
production startup evidence. It does not establish live-provider behavior, complete
GET purity, whole-app least privilege, a performance gain or minimum memory sizing.

GitHub MCP searches found no open PRs in cloudbyday90/Harmoniarr, so random PR
implementation and stale-PR cleanup were inapplicable. Work remains on main with
no release, tag, branch creation or PR merge.

Recommended stack: fatal startup preparation → shared read-only migration reader
→ existing service policies → authorized/idempotent commands and no-store reads.
It removes repeated catalog writes while retaining strict failure and durability
boundaries. A dedicated role/pool or serialized preparing helper adds contracts
that this change does not need.

Next recommended item: distinguish unavailable migration status from pending
migrations in onboarding. Its current fallback represents a failed lookup as one
pending item; the new missing-schema control confirms attention behavior but does
not improve that wording. Add an explicit unavailable state and accessible status
feedback while preserving refresh focus and fatal startup validation. A later CLI
audit can separate diagnostic reads from explicit schema preparation.
