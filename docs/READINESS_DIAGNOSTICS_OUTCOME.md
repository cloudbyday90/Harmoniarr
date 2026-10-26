# Readiness diagnostics and migration observation outcome

October 26, 2026. Implements the next item from
[recovery interruption qualification](BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md).
See the separate [research and tradeoffs](READINESS_DIAGNOSTICS_RESEARCH.md),
[design](READINESS_DIAGNOSTICS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_READINESS_DIAGNOSTICS_OUTCOME.md).

`/healthz` now returns a minimal no-store success envelope and generic failure
responses with an opaque reference. Database name and PostgreSQL data directory
are intentionally removed from the public contract. Repository consumers require
health/service/migration state, not those private fields; the provider readiness
validator and Docker health check are covered by packaged validation. Internal
database identity remains available through its existing privileged sources.
External health consumers that read the two removed fields must adjust; the
successful service, start-time, port and pending-migration fields are retained.

Separate ESM modules own classification, history, log admission and actual check
completion. Retain sixteen safe scalar failures, latest completion and saturating
counters. Emit at most one log line per fifteen seconds and admit at most one
pending write; backpressure blocks further output until drain. Observe synchronous,
callback and asynchronous stream errors. After an output error, keep history while
closing further log admission. Close waits for actual output completion and retires
owned listeners. Do not retain raw exceptions, SQL, paths, users, headers or stacks.
Original Error/null identity is preserved internally; connection failures retain
503 mapping and unexpected failures remain 500. There is no retry or cached success.

Per-check stage closures keep overlapping attribution separate. Health-check
ownership is selected by application drainage, so an HTTP disconnect does not
abandon an admitted database query before cleanup. This extends the existing
owner-drain API; it does not prove every production shutdown boundary or impose
a hard bound on request work, stderr latency or whole-process memory.

Existing administrator Recovery diagnostics and exports include the safe history.
The existing diagnostics response now has no-store. The new informational panel
renders at most five rows, uses shared finite labels, wraps references and states
that history is process-local and stages are observations. Existing refresh focus
and status announcements remain the interaction boundary. Restart loses history,
and administrator authentication/other diagnostics still depend on the database.

The first immutable diagnostic candidate reproduced a fresh HTTP 500 during the
container-replacement qualification. Its public reference matched a sanitized
`migration_status` log record. The fixture stopped and retired its container,
probe and owned persistent volume; its failed evidence was retained. It did not
complete any of the eighteen replacement cases and is not counted as a passing
matrix. The then-unrecognized code was intentionally projected as null/unknown.

Inspection found that `getMigrationStatus` prepares extensions/functions/tables
on each call. A separate disposable packaged experiment ran fifty calls in five
batches of ten: seventeen succeeded and thirty-three failed; the first ten bounded
samples were PostgreSQL `XX000` ("tuple concurrently updated"). This establishes a
reproducible catalog-write race in that reader. It does not establish the original
exception behind the earlier uncaptured health response or blame host load.

System overview now uses `schema-migration-status-service.js`: list packaged
filenames and read applied filenames through the existing store, with no bootstrap
DDL. Missing schema and manifest/database errors remain failures. Startup preparation,
migration/checksum validation and legacy preparation behavior are unchanged.
`XX000` is now a known safe diagnostic code, without parsing or retaining its raw
message or asserting that every internal database error has this cause.

The final stable gate passed 6,131 server, 4,491 client and 700 script tests, plus
lint, copyright, schema/migration, ESM, image-tag, Compose and build checks. Focused
reader tests require exactly one SELECT, pending-file parity and no attempted
repair on missing schema or Error/null. The real-browser regression covers held
loading, bounded rows, private-field exclusion, log-output failure, unavailable
snapshot, HTTP error/retry, retained refresh focus and 390 px layout. Manual
screen-reader and physical-device checks remain deferred.

The final immutable no-cache image passed the guarded native readiness entry:
an actual PostgreSQL read-only transaction, fifty concurrent healthy HTTP reads,
and four actual failures (missing file, invalid relation, cancelled query and
refused connection). Safe references/stages/codes/statuses matched, private data
was excluded, Error identities were retained, the sixteen-record cap held and a
failed log sink did not replace the health result. An independently observed
advisory-lock wait remained owned after HTTP abort; close waited for actual query
completion and refused later admission. Administrator/unauthenticated/requester
access produced the expected 200/401/403 responses.

The packaged normal-startup recovery entry also passed. A fresh repeat of all
eighteen abrupt container-replacement cases passed on nineteen production
containers with background services enabled. The thirty-seven captured container/
startup logs contained no readiness failure records. All owned containers,
probes and persistent test volumes were retired and absence verified. This is
process/container interruption evidence, not hardware power-loss qualification or
a minimum memory requirement.

Runtime comparison verifies the ten changed server modules, shared descriptor
and rebuilt client against frozen source/build hashes. All other server/shared
files, runtime npm/OS dependencies and six mapped native binary identities match
the preceding committed image. Unchanged manual-backup filesystem, SQL/producer
crash, recovery-worker interruption and media/codec matrices retain their preceding
qualification; they were not rerun as new evidence. The changed health/startup
composition has fresh native proof. No dependencies changed and npm audit found
zero vulnerabilities.

GitHub MCP checks found no open PRs in `cloudbyday90/Harmoniarr`; random local PR
implementation and stale-PR cleanup were inapplicable. Work remains on main with
no release, tag, PR merge or branch creation.

Recommended stack: fatal startup preparation → read-only migration observation →
request-owned readiness stage/ref → bounded process history and throttled,
backpressure-aware logs → existing administrator Recovery diagnostics. It keeps
deployment and ownership simple while accepting volatile history and suppressed
log records. A new daemon or diagnostics table adds no value for this scope.

Next recommended item: audit remaining HTTP observation callers of the legacy
migration-preparation helper, beginning with onboarding summary. Move prepared-state
reads to the new reader and keep explicit preparation in startup/CLI paths. Qualify
real concurrent reads and read-only transactions before considering a separate
minimal readiness policy; preserve fatal missing-schema/checksum startup checks.
