---
name: harmoniarr-testing-validation
description: Use this skill when choosing, running, or explaining Harmoniarr validation for code changes. Trigger for test planning, deciding focused versus full validation, Vue/client changes, backend service or route changes, migrations, schema snapshots, Docker/local deployment checks, release evidence, CI failures, or any request to make a change with high confidence.
---

# Harmoniarr Testing Validation

For operator request publication, test actual SQL guards after planning, identity
contention and event insertion, including latest save, changed policy/selection/
override/catalog, lease replacement/clock expiry, disabled actor, cancellation,
partial progress and duplicate concurrency. Preserve request/event rollback and
await native client end after uncertain rollback. Production lease heartbeat
renews immediately: a controlled short-expiry fixture must own that choice or
renewal can replace its intended deadline. Inspect this before broad native gates.
See `docs/OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_OUTCOME.md` for retained
stopped-candidate evidence, final gate scope and writer coordination limits.

Cancellation rechecks inside a publication transaction must forward its queryable
through the existing worker/interruption/store adapters. A third pool checkout
can starve behind an admitted blocked save or publisher with a two-client pool.
Use an independent, owned-config observer for contention proof; do not enlarge
the application pool or spread internal pool.options to make a test pass.

Operator artist reconciliation now returns actual completion and terminal close.
See `docs/OPERATOR_ARTIST_RECONCILIATION_LIFETIME_OUTCOME.md`: native tests hold
scoped snapshot reads, required request-event transactions, real discovery
reconciliation and release across both app fixtures. Assert resources and durable
evidence outside swallowed callbacks. Parallel-task rejection must wait for all
returned sibling reads, including the traced nested batches; preserve first
observed Error/null. This does not certify hidden detached work or mutation-time
policy/lease fencing. Keep each transaction on one client and retain per-release
atomicity, cancellation checkpoints, deadlines and remaining fixture delay.

## Default Approach

Run the smallest focused tests that prove the changed behavior, then broaden based on blast radius. Before commit or push, run the validation level appropriate to the risk.

Use `npm run validate:fast` for complete static, server/client/script and build
feedback during development. It omits PostgreSQL; include the directly affected
real database tests when SQL, locks, constraints or rollback own the behavior.
Select owning services plus affected callers/consumers explicitly; filenames or
direct-import graphs alone cannot establish that selection's completeness.

Finish source review and inspect focused logs for warnings before a complete
gate. Combine affected integration files once, rather than running the new file
and then repeating it inside the same broader group. Once those pass, reserve
the complete gate for the stable final candidate; repeat it after material code
changes, failures or unresolved concerns.

`npm run validate` retains the complete serial gate; use
`npm run test:integration:serial` for its database layer explicitly. The local
two-worker experiment exposed a recovery failure and was not promoted. Read the
documented outcome before attempting further scheduling experiments; a faster
run with failures cannot replace passing coverage. Preserve per-file process isolation and serial scenarios
inside each file: the app harness changes process environment and the global
pool. Parallel files do not permit overlapping queries on one pg client or
sharing mutable scenario databases. See the repository's
`docs/TEST_EXECUTION_EFFICIENCY_DESIGN.md` and outcome for evidence and limits.

If a scheduling experiment fails, reject promotion before changing deadlines or
assertions. Stop a rejected experiment when further work cannot change that
decision, preserving actual failures and stopping only its owned resources.
Report incomplete counts honestly. Diagnose the smallest failing scope with TAP
or another reporter that exposes error details promptly; a spec-only long run
can defer stacks until its final summary. Fixture barriers should race the active
operation's failure and always release/drain in cleanup, including cancellation.

The serial integration script now pairs native spec output with an early bounded
failure reporter. Its approved category and project-relative frames become
available on native failure events; other native output is independent. For
setup investigation, enable `HARMONIARR_INTEGRATION_PHASE_TIMINGS=1`. Phase rows
contain opaque correlation, approved labels, outcomes and monotonic durations;
overlapping parent/child spans must not be summed as gate wall time. Failed
verification is not successful cleanup. See
`docs/TEST_FIXTURE_OBSERVABILITY_OUTCOME.md` for current measured limits.

Use `testing/integration/fixture-lifecycle.js` for controlled gates and tracked
cooperative work. Release failure must cancel signal-dependent drains too; an
earlier blocked task cannot hide a later rejection. These helpers do not stop
arbitrary I/O or make an unreleased client safe to close. Never terminate/drop a
database unless this invocation acknowledged creating it.
Reject pre-aborted startup and register observed completion before launching
detached work; refused late registration must not leave a worker running. Startup
failure must settle that registered completion rather than hanging its drain.

Wanted explicitly opts into a per-file migration-only template. Keep its fresh
scenario clones and idempotent migration check; do not template dedicated
migration/bootstrap/recovery validation. Use `HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE=empty`
for a comparison profile. Source admission requires verified input lineage,
connection sealing and zero active source sessions. Strict selected-mode cleanup
rejects otherwise successful work after cleanup failure; original errors still win.
See `docs/POSTGRES_TEST_TEMPLATES_DESIGN.md` and its outcome for ownership and
measurement limits. Build independent clients from owned connection config;
spreading internal `pool.options` can omit protected, non-enumerable credentials.

Use PowerShell commands from the repository root.

Release reconciliation and tag snapshots also select a private per-file migration
source. Their independent overrides are `HARMONIARR_INTEGRATION_RELEASE_SCHEMA_MODE`
and `HARMONIARR_INTEGRATION_TAG_SCHEMA_MODE`: `empty` preserves comparison and
`migration_template` selects the audited path. Global/dedicated
bootstrap/recovery defaults are unchanged. Measure actual schema, seed and work
spans; tag work includes seeding, so don't add nested spans twice. The per-clone
migration call is an idempotent filename check; complete source key/checksum/status
lineage belongs to the existing template owner. See
`docs/LIBRARY_TEST_SCHEMA_TEMPLATES_DESIGN.md` and its measured outcome.

Catalogue now selects its own verified migration-only source after the scoped
worker/task/observer/workspace audit. Use
`HARMONIARR_INTEGRATION_CATALOGUE_SCHEMA_MODE=empty` for comparison, or
`migration_template` for explicit selection. Dedicated catalogue adverse
lifetimes still prepare empty databases. Its seed/work spans do not overlap;
scenario_work includes actual drain and manual lease finalizers. See
`docs/CATALOGUE_TEST_LIFECYCLE_DESIGN.md` and its outcome for unchanged native
cases, Error/null rollback, clone isolation, pre-seed refusal and local variance.
Remove override variables for default-mode proof; an empty value is a deliberate
strict refusal, not absence. Avoid repeating a passing cohort after promotion
when the final complete gate already exercises its changed default.

`npm run test:integration:shared-postgres` is an opt-in serial Wanted/catalogue/
release-reconciliation/tag-snapshot cohort. It owns one fresh server, preserving
isolated file processes, databases
and pools. The default complete gate is unchanged. Do not expand its allowlist
until every fixture-created database has the parent reserve/CREATE/OID commit
contract. Raw Dockerized fixtures and manually created siblings require separate
ownership work. Close admission, observe the actual child close and known-worker
absence, then reconcile before the next file. A signal acknowledgement or reporter
end is insufficient. Unknown/replacement identities are refusals, not prefix-based
cleanup targets. See `docs/POSTGRES_TEST_LAUNCHER_DESIGN.md` and its outcome for
measured scope and process/platform limits.

The audited extension uses scoped gates and actual worker/task drainage before
temporary media or database teardown. Defer captured lease SQL until held
transactions drain; discard clients after uncertain BEGIN/ROLLBACK. A borrowed
paused transaction must stop observer admission on abort, drain its current read
before rollback, and refresh PostgreSQL's monitoring snapshot before each activity
poll. READ COMMITTED row snapshots alone don't refresh that cache. Native test
signals can also abort after normal completion. See
`docs/SHARED_POSTGRES_COHORT_ADOPTION_DESIGN.md` and its outcome for adverse proof,
the retained failed candidate and matched-order measurement limitations.

## Validation Matrix

Client utility or composable:

- Focused: `node --test test/client/<matching>.test.js`
- Broader: `npm run test:client`
- Always add `npm run lint:client` for changed `src/client/**/*.js` or `*.vue`

Vue view or component:

- Focused unit tests when present.
- `npm run lint:client`
- `npm run build:client`
- Use `$webapp-testing` or `$web-design-reviewer` when layout, interaction, keyboard behavior, or responsive rendering matters.

Server service or store:

- Focused: `node --test test/server/<matching>.test.js`
- Broader: `npm run test:server`
- Add integration tests when behavior depends on real PostgreSQL state, route middleware, sessions, CSRF, operation queues, or cross-module wiring.

Route changes:

- Focused route tests in `test/server/*routes*.test.js`
- Add integration coverage for auth/session/CSRF/database-backed behavior when mocks cannot prove the contract.
- Check `src/server/route-inventory.js` when adding, removing, or changing API routes.

Migration or schema work:

- Run migration filename checks through `npm run migration:check`.
- Run schema snapshot checks through `npm run check:schema-snapshot` when the database/snapshot surface is touched.
- Run `npm run validate:schema-bootstrap` or `npm run validate:database` when bootstrap behavior matters.

Scripts or release tooling:

- Focused script tests in `test/scripts/`.
- `npm run lint:scripts`
- Run the script directly when it has observable CLI behavior.

Before commit for substantial work:

- `npm test`
- `npm run build`

Before high-risk release, Docker, or database changes:

- `npm run validate` when time and local prerequisites allow.
- Add the relevant Docker validation scripts from `package.json` only when the change affects packaging, image startup, Compose, or release evidence.

## Test Design

- Prefer tests at the module boundary that owns the behavior.
- Add route/integration tests when middleware, session freshness, CSRF, database transactions, operation-run visibility, or startup wiring are part of the contract.
- Keep test doubles small and explicit; inject dependencies into service factories rather than mocking global modules.
- Assert durable state and response shape, not implementation trivia.
- For UI state, test pure helpers and composables first; use browser checks when visual or interaction behavior cannot be proven otherwise.

## Failure Handling

When validation fails:

1. Read the first failing assertion or build error.
2. Reproduce the smallest failing command.
3. Patch the cause, not the test expectation, unless the expectation is stale because the contract intentionally changed.
4. Re-run the focused failing command.
5. Re-run the broader command that originally failed.

## Reporting

In final updates, report exact commands run and whether they passed. If a command could not run, state the concrete blocker and the remaining risk.

For a first app-fixture checkout, the default bounded observer emits failures;
`HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS=all` adds first start/success and `off`
disables it. Pair its correlation ID with schema phases when timings are enabled.
Use pre/requested/settled counters and approved cause codes; an uncoded queued
timeout is not proof of a socket timeout. The observer adds no probe/retry and
does not classify subsequent schema SQL as a checkout failure. Keep last server
admission and driver closing flags separate from live-health/drain proof. See
`docs/APP_FIXTURE_CHECKOUT_DIAGNOSTICS_OUTCOME.md` for native controls, actual
version and retained failures before changing app-pool shutdown or scheduling.

The shared pool lifecycle now refuses replacement while native end is pending
or failed, sharing the original close promise and failure. Native held-client
proof is in `test/integration/database-pool-lifecycle.test.js`; the controlled
HTTP closure proof keeps detached application work separate from socket drain.
See `docs/DATABASE_POOL_SHUTDOWN_OUTCOME.md`. Successful end permits serial reuse
and does not fence a preceding invocation after restart. Keep the fixture delay
until actual launched worker completion/admission has been owned and tested;
neither more sleep nor an async-context getter guard drains captured resources.

Before a complete native gate, verify local ffmpeg/ffprobe or configure an
existing verified media image through `HARMONIARR_INTEGRATION_MEDIA_IMAGE`.
Capture its immutable image ID and observed tool version; the shared media
fixture runs without network access and mounts only its owned workspace.
Count native skips explicitly. If tooling was absent, run the owning media files
with that prerequisite supplied rather than repeating an otherwise passing full
gate when code is unchanged. Report both runs separately; their combined coverage
is not one skip-free complete run or a matched performance benchmark. Restore
the scoped environment afterward.

Apply-worker close now owns admission and actual finalization through returned
advisory callbacks, `stopAndDrain()` renewal completion and captured lease release.
The queued start acknowledgement and durable terminal status are earlier
boundaries. Gate these independently; a duplicate run must remain coalesced until
release settles, and failed scheduling must not orphan work. Both app fixtures
drain their concrete apply owner before pool/environment teardown and preserve
Error/null scenario failures. See `docs/APPLY_WORKER_LIFETIME_OUTCOME.md` for
executed evidence and the remaining child-scan/other-worker boundary. Keep the
residual delay until those owners are audited; do not extrapolate this one worker
to complete application quiescence or faster full-gate coverage.

Retain the apply start acknowledgement's `completion` handle when a fixture
needs one run to finish before changing its shared hooks or workspace. Await
that actual result, then read domain status once; polling terminal status is not
an execution drain. Awaiting the acknowledgement alone still does not wait for
the job. Capture readiness against the completion promise so startup failures
cannot strand a held checkpoint. A full-run assertion passing in isolation is
unreproduced evidence, not a diagnosis or proof that a different lifetime fix
caused its remediation.

When a native connection failure recurs, capture evidence from the invocation's
actual server before cleanup where possible. Distinguish a socket reset during
SQL, first connection establishment and an observed queued waiter. Last server
admission, a later healthy container and an isolated passing retry do not prove
health at the failure or its cause. Existing Testcontainers server logging can
support an explicitly scoped diagnostic run; retain raw vendor logs locally,
since they may include SQL or sensitive values, and publish only bounded reviewed
findings. Restore diagnostic environment variables, preserve original bounds,
and refuse cleanup against unknown process/container identities. The apply
outcome retains the current full-run failures and separate diagnostic passes.

Owned-server failure evidence now captures schema failures before app cleanup and
temporary-database failures before pool/drop cleanup. Default failure-only mode
runs no probes on success; set HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS=off to
disable it. Automatic probes require the default fresh Testcontainers capability;
external, reused, custom and pre-cancelled contexts remain unavailable without
new traffic. Keep independent host authentication and container readiness
separate. Nonzero Docker CLI exits are command failures, not certified PostgreSQL
rejection/no-response codes. Preserve original Error/null and await both probe
completions. Locate the factories in testing/integration/postgres-failure-*.js,
postgres-host-probe.js and postgres-readiness-probe.js; the dedicated failure
evidence outcome owns executed scope and historical-cause limits.

Dispatcher lifetime now has terminal stopAndDrain in addition to ordinary timer
pause. Gate admitted claims across closure: a committed returning claim must
handoff once, with no later claim, before launch admission seals. Await handler
and optional queued completion; acceptance-only legacy workers remain unowned.
Prove sibling/tick/stop/reporter failures and Error/null precedence through actual
drainage. Supervisor prefers terminal drainage before resource cleanup. Keep
the residual fixture wait until library scan and remaining workers are owned;
docs/DISPATCHER_LIFETIME_OUTCOME.md separates executed native scope from claims
about full-app quiescence or faster exhaustive validation.

Library scan now returns actual completion and has terminal close; coalescing
extends through admitted heartbeat renewal and lease release. The shared
worker-lease cleanup attempts release after drain failure, preserving original
Error/null. Application drainage captures apply/scan owners, drains the producer
first and attempts scan cleanup after apply failure. Standalone scan fixtures
wait for returned execution beyond callback observation, without hanging behind
an unreachable observer on early execution failure. Keep callback errors and
legacy injected test-double limits explicit. See
docs/LIBRARY_SCAN_LIFETIME_OUTCOME.md; remaining workers and hidden/unreturned
work still prevent deleting the residual delay or claiming whole-app drainage.

Import execution now returns actual completion through provider preparation,
enqueue, confirmation, returned Activity and lease finalization. Queued acceptance
and remote download completion remain separate. Both handoff/recovery fixture
helpers retain the real handle, including early execution failure before an
unreachable release observer. Preserve callback-observer Error/null policy and
legacy double limits. Gate admitted renewal, provider and Activity work separately;
application cleanup captures execution/apply/scan before awaiting, attempts all
known owners after failure and preserves the earliest failure. See
docs/IMPORT_EXECUTION_LIFETIME_OUTCOME.md. Other workers, periodic work and hidden
callbacks remain unowned; do not remove residual delay or infer a whole-suite
performance improvement from focused timings.

Media inspection now retains actual completion through returned preview,
diagnostic Activity, admitted renewal and captured lease release. Gate normal
command/stdout close separately from process exit; a controlled Node probe tests
process ownership, not ffprobe behavior. Application drainage captures concrete
execution/inspection/apply/scan owners and attempts all known cleanup after
Error/null. See docs/MEDIA_INSPECTION_LIFETIME_OUTCOME.md for native process and
both app-fixture evidence. Keep command-error, hidden descendant and remaining
worker limits explicit; no terminal status or residual sleep certifies complete
application quiescence.

Transcode orchestration owns returned preview/preflight through admitted renewal
and captured lease release. The current service runs ffmpeg null-output preflight;
do not infer file mutation or a child-worker launch from its name. Gate normal
command/stdout close, held preview cancellation and late admission separately.
worker-owner-drain snapshots ordered concrete owners, preserves receivers and
retains first Error/null while attempting all selected cleanup. Application now
selects execution/inspection/transcode/apply/scan. The transcode lifetime outcome
owns actual PostgreSQL/process scope; controlled Node process proof is not codec
correctness, exhaustive validation or complete application quiescence.

Organize apply now owns guarded movement, returned notification/Activity and
renewal/release cleanup. Await its actual handle in native mutation and unit
fixtures; fixed 100 ms sleeps and release observation are earlier boundaries.
Use parent-visible checkpoints for best-effort callbacks, since assertions thrown
inside them can be swallowed by outcome policy. Prove callback completion and
release ordering outside that adapter, then byte/catalog/database availability.
Application selects execution/inspection/transcode/apply/organize/scan. The
organize lifetime outcome separates the broader native group from a strengthened
fixture-only rerun; do not sum repeats or describe unchanged production evidence
as a new exhaustive/matched performance result.

Discovery now retains actual completion through reconciliation/artwork/provider,
release and eligible pruning. Unit consumers and scoped recovery fixtures await
that handle beyond callback observation; preserve guarded false returns and earlier
callback error identity. Gate release and pruning separately, including skip rules
after lost/refused authority or thrown cleanup. Application selects discovery
before execution/inspection/transcode/apply/organize/scan. See the discovery
lifetime outcome for PostgreSQL/HTTP scope and remaining owners. Verify literal
selected test paths before launching: this Node host silently ignored an unmatched
entry in an otherwise passing focused run. Globs require their own selection
review, and a green subset is not completeness or remote-operation completion.

External intake now returns actual completion through planning, awaited durable
execution handoff and renewal/release. Await that handle in planning-only fixtures;
the queued start acknowledgement alone remains earlier than actual execution.
Gate planning, queued execution and captured release separately. Native proof
uses both app fixtures with real stores and parent-visible normalized source,
recipient/actor, pending execution and resource checkpoints. A completed planning
run precedes release, and a pending child run is not provider completion. See
docs/EXTERNAL_INTAKE_LIFETIME_OUTCOME.md; other worker/periodic owners keep
the residual fixture wait and limit whole-app/performance claims.

Provider ingest now returns actual completion through provider/collection service,
guarded persistence and renewal/release. Await it in executor cancellation fixtures
and gate accepted start, returned service result, terminal status and release as
separate boundaries. Parent-visible native HTTP checkpoints use the real clients
with an injected owned loopback transport; they do not establish live-provider or
post-abort hidden completion. Keep partial row counts and bounded preparing/ready
collection status distinct from worker completion. The dedicated provider-ingest
outcome owns both app-fixture and collection publication/cancellation evidence.
Remaining metadata/periodic owners keep the residual fixture delay.

External request discovery now returns actual completion through returned search,
candidate transaction/audit and renewal/release. Await it beyond queued acceptance
and release observation; retain sanitized failure, no-candidate/manual retry and
the distinct acquired-unavailable lease outcome. Native parent checkpoints use
real approval, slskd client/service and candidate stores, proving current-target
publication refusal after held response. Owned dispatch retains its 15-second
bound via fixture lifecycle, retains worker completion beyond claim/tick completion
and then reads persisted status once; drain dispatcher
and worker before disposal while preserving original Error/null. The dedicated
external-request discovery outcome owns executed evidence and limits. Other
workers/periodic producers still prevent removing residual delay or claiming
complete application drainage or exhaustive speedup.

Metadata artist refresh now returns actual completion through provider/catalog/
wanted/queue/detection and returned scheduling, then renewal/release. Preserve
captured worker context and cancellation hooks, and distinguish queued operator
reconciliation from executed child work. Gate provider response, schedule write
and release separately in both app fixtures, using parent-visible catalog/date/
resource assertions. Unmonitoring during lookup must exercise existing schedule
clearing. Wanted projection's native fixture retains actual worker completion
beyond its release observer. Startup explicitly supplies metadataModule so the
eleven-owner snapshot includes metadata; fixture whole-application input alone
does not prove production wiring. The metadata refresh outcome owns executed
scope and remaining reconciliation/periodic limits; keep residual fixture delay.
