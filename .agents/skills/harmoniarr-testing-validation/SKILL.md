---
name: harmoniarr-testing-validation
description: Use this skill when choosing, running, or explaining Harmoniarr validation for code changes. Trigger for test planning, deciding focused versus full validation, Vue/client changes, backend service or route changes, migrations, schema snapshots, Docker/local deployment checks, release evidence, CI failures, or any request to make a change with high confidence.
---

# Harmoniarr Testing Validation

For shared FFmpeg/FFprobe limits, use the standards skill's
[native command reference](../harmoniarr-web-standards/references/media-command-admission.md).
Run focused caller/worker tests before the explicit Linux
`validate:native-media-command-admission` and shared-container memory lanes.
`validate:native-media-worker-cancellation` adds held-close durable cancellation
and actual FFmpeg interruption. Keep its codec polling control separate from the
one-second production interval, and pair it with the six readiness/queued/active
PostgreSQL cases plus existing worker-lifetime tests.
`validate:native-media-worker-lease-interruption` adds replacement-acquisition
refusal with held native close and real FFmpeg interruption. Use its explicit
renewal tick only as a qualification control; the production heartbeat remains
60 seconds. Pair it with readiness/queued/active replacement and own-expiry
PostgreSQL cases; prove stale terminal writes and releases cannot alter a new owner.

For decoder memory controls, use the standards skill's
[worker memory](../harmoniarr-web-standards/references/worker-memory.md) reference.
Keep actual external allocation refusal and concurrent maximum images in explicit
Linux lanes, separate from cheap policy/framing tests. Verify kernel limits/OOM
counters and drain every child before cleanup; DATA is not RSS or a RAM reservation.
For weighted admission and metadata/grant changes, read
[aggregate reservations](../harmoniarr-web-standards/references/aggregate-reservations.md).
Include both ingestion and fetch callers of the shared FIFO, with native-active
cancellation after grant and held publication after actual child retirement.
`validate:native-deployment-memory` qualifies shared-container app composition,
retained caller buffers, actual provider-image TLS and held native PostgreSQL work.
Use fresh 2/3 GiB profiles from docs/DEPLOYMENT_MEMORY_DESIGN.md; do not substitute
Node RSS for whole-container usage or claim unexecuted cgroup/media-worker coverage.
`validate:native-deployment-media-memory` adds bounded real scan/tag persistence,
FFprobe and FFmpeg null-output encoding. Preserve the preceding three cases and
require actual overlap/close, released lease rows and unchanged original bytes.
See docs/DEPLOYMENT_MEDIA_MEMORY_DESIGN.md for controlled planning and scope limits.
`validate:native-artwork-corpus` owns seven fixed entropy/sample-depth cases in a
one-CPU/1 GiB Linux profile; the allocation/concurrent-byte lane keeps its separate
two-CPU/3 GiB profile. Their shared test-only cgroup helper requires actual v1/v2
controls and OOM counters. Do not repeat unrelated client/SQL suites for a corpus-
only change when exact packaged runtime/source comparisons establish unchanged code.

For actual provider HTTPS, use [provider HTTPS qualification](references/provider-https.md).
It owns child-scoped trust/proxy configuration, preserved DNS identity, native
redirect/body refusal and deadline-driven socket retirement without live accounts.

For one-time privileged CLI results, use the standards skill's
[delivery reference](../harmoniarr-web-standards/references/cli-result-delivery.md).
Qualify actual child stdio close/exit separately from capture-writer assertions.

For native media-to-import qualification, read
[native audio import](references/native-audio-import.md). It separates successful
transport from actual content inspection, canonical apply and catalogue publication.


For native retry exhaustion and changed-size negotiation refusal, read
[native refusal](references/native-refusal.md). It owns bounded failed attempts,
absence of a mismatched file connection and final incomplete-only storage.

For actual provider default retries and nonzero-offset recovery, read
[native resume](references/native-resume.md). It distinguishes native retries
from application POST ownership and requires verified prefixes and final hashes.

For native EOF/RST failures, read
[partial transfers](references/native-partial-transfer.md). It owns single-attempt
fault isolation, observed incomplete prefixes, failed receipt classification and
final file checks after acknowledged provider retirement.

For completed native file bytes and filesystem identity, read
[native file transfer](references/native-file-transfer.md). It owns the framed/raw
transition, one-file token capabilities, bounded sends and separate read-only
publication proof. Synthetic binary payloads do not establish music import.

For real slskd batch/receipt qualification, read
[native provider qualification](references/native-provider-fixture.md). It owns
the account-free internal-network fixture, exact native identity, queued-state
limits and strict process/container/file retirement.

For Docker smoke networking, read [published-port ownership](references/docker-smoke-ports.md).
It covers complete port replacement, acknowledged service identity, per-phase
endpoint resolution and refusal before HTTP, with native cleanup evidence.

For TestsStream warnings or reporter composition changes, use
[reporter ownership](references/reporter-ownership.md). Trace actual fan-out,
preserve default warnings and prove EOF, Error/null and native output drainage.

For implementation-sensitive dependency upgrades, build-install removal and local PR evaluation, use
[dependency implementation review](references/dependency-implementation-review.md).
Review published bytes/transitive owners, preserve failed candidates and test the
actual consumer before expanding exact support guards or broader validation.

Native PostgreSQL TLS identity proof uses postgres-tls-fixture.js and
pg-tls-attempt.js with fixture-local public test keys, default Node verification,
actual IP/DNS acceptance/refusal, real pg_stat_ssl queries and socket close.
pg queues startup on sslconnect before secureConnect; buffered local dispatch
must not imply authenticated delivery. See docs/POSTGRES_TLS_IDENTITY_OUTCOME.md
for actual scope, retained uncertain workspaces and unperformed TLS coverage.

HTTP fixture attribution belongs at the owned server request boundary. The
server/request/response dispatch adapters preserve native listener order, body
callbacks and Error/null; they do not infer context from client-side measures or
headers. Factory-owned phase scopes retire on response finish/close or cleanup;
nested measures inherit expiry and late work stays unknown. Prove native POST
body/end, disconnect, nested/concurrent ownership, exact restoration and both
app entrypoints' real checkout records, including timing-disabled context. See
docs/FIXTURE_HTTP_PHASE_OUTCOME.md for actual gate scope and retained failures.

Wanted root correctness stays in library-wanted-root-profile.test.js as one
native paired-reader/current-authority case. Its full scaling matrix is explicit:
`npm run measure:wanted-guarded-workload -- --root-lookups --output <local JSON>`.
Require six scenarios/48 unique samples, private projection and unchanged query/
hash/phase-call proof before summaries, and actual cleanup through first Error/null.
Reduced selections are selected evidence. See docs/WANTED_ROOT_TEST_LANES_OUTCOME.md.

For guarded workload selection or failure diagnosis, read
[the focused reference](references/guarded-workload-selection.md). It owns media
prerequisites, recorded full/selected scope and approved phase/failure evidence;
retain historical failures and unchanged private comparison/resource contracts.
That reference also owns the eight-case automatic library-add media comparison:
unchanged test bodies, equal work, complete counterbalanced samples and cleanup.
For its before-hook investigation, that reference distinguishes original tooling/
runtime completion, unavailable returns and raw phase versus aggregate evidence.
It also owns prerequisite command close, acknowledged image retirement and the
limits of installed-driver compatibility when locally evaluating dependency PRs.

Server startup evidence needs fresh default PostgreSQL 18 ownership, structured
JSON/source locations and a private unnamed-client startup marker. A unique
authorization record binds the original client to one PID/session; only ordered
records from that session can describe earlier receipt/authentication. Zero
SQLSTATE is omitted, and early receipt has an uninitialized backend type. Keep
pre-auth/NAT windows unassociated, explicit app names unchanged and unknown/
clipped evidence honest. Capture context before scheduling, drain failure-only
bounded probes before cleanup and preserve Error/null. See
docs/POSTGRES_STARTUP_SERVER_OUTCOME.md; historical failures are not diagnosed
by successful new controls.

Source no-op validation needs exact owned already-existing positive rows locked
until outer publication ends, private queryable/transaction authority, native
busy-row savepoint recovery and transaction-reuse refusal. Keep the actual-write
and final complete projection/lease/cancellation guards with fresh opening and
closing hashes. Compare private request/event/link results and all retained
projection digests; hash work intentionally differs from compatibility and
cannot use the unchanged-work comparator. Keep the large --source-noops matrix
explicit. See docs/WANTED_SOURCE_NOOP_OUTCOME.md for scope and failed candidates.

Distinct-binding profiles must grow actual canonical deliveries and saved scopes,
count real paths/device-inodes separately from historical receipt copies, and
declare owner/context dimensions. Compatibility satisfied-source guards perform
bindings+5 projections; count proved no-ops separately in the optimized path.
Preserve exact private result/digest comparisons and both full hashes per group
per projection. Keep the large workload explicit, use bounded native mutation/
required-event rollback proof, and keep pure policy tests free of app imports.
See docs/WANTED_DISTINCT_BINDING_PROFILE_OUTCOME.md for evidence and limitations.

Cold connection validation needs the original driver client, privately compared
acknowledged target and pre-pool-ready startup milestones. Prove a real startup
hold, matched successful promise/query-callback clients, method/listener restore
and Error/null preservation. Queued cold clients require the exact PendingItem
mapping in owned-pg-queue-observer.js, not release-time async context. Version-three
checkout records distinguish queued/create/acquire-entry/delivery; reuse gets no
invented cold milestones. Unknown mappings remain unassociated. See
docs/POSTGRES_QUEUED_CHECKOUT_OUTCOME.md for native controls and scope. Separate
TLS stream creation from handshake completion and backend readiness. Internal
adapters must refuse unreviewed driver versions. Historical healthy probes do
not diagnose failures captured before this instrumentation. See
docs/POSTGRES_CONNECTION_BOUNDARY_OUTCOME.md for native and workload scope.

Local startup write evidence uses the reviewed native method, plain string-only
packet and native Socket/TLSSocket capability. Scope stream.write decoration to
the synchronous startup call; auth/query traffic must keep its original method.
Prove held/error/late callbacks, original wire bytes and Error/null, then actual
held startup and successful query paths. Return/backpressure, callback completion,
server receipt and authentication remain separate. See
docs/POSTGRES_STARTUP_WRITE_OUTCOME.md; unavailable evidence never grants progress.

Bounded root validation requires real held authority, enabled unconditional
statement guards, exact function/column contract and an invocation token bound
to current transaction/queryable. Prove expiry during closing work, fabrication,
connection reuse, absent-owner transaction mismatch, same-transaction root changes
and same-marker bytes. Compare exact private projections and identical hash/byte
work against member roots with equal proof overhead. Custom/standalone paths stay
conservative. See docs/WANTED_BOUNDED_ROOT_READ_OUTCOME.md; timings are not caps.

Root-authority coordination must prove a real publisher held after its final
source check, statement-writer blocking and commit/rollback release. Use an
independent owned observer when both pool clients are held. Test writer-first
committed revocation on a fresh post-admission statement, missing/null settings,
unrelated login progress, pending migration and snapshot-installed enabled
anchors. Compare function bodies without collapsing literal whitespace; named
disabled/changed triggers are not guards. Preserve both hashes and every root
read until separate batching proof. See docs/WANTED_ROOT_AUTHORITY_COORDINATION_OUTCOME.md.

For root-cost profiling, use the explicit --root-costs benchmark with matched
closed-group diagnostics-off/on samples. Actual native root-store query counts
must match root-resolution calls; statement drift refuses attribution. Keep
signed process-memory windows, periodic peaks and observer overhead separate;
nested windows cannot be summed or treated as allocation ownership. Preserve
all current reads/hashes and original Error/null. See
docs/WANTED_ROOT_COST_PROFILE_OUTCOME.md before considering read batching.

Closed receipt groups need opening and closing full hashes with independent
current-root reads and captured source identity, not metadata reuse. Prove real
same-size/same-time in-place mutation, source/root changes, negative/mixed/budget
fallback, sparse/accessor-array refusal and original Error/null/held completion.
Canonical default wiring must execute actual publication/event rollback. Keep
candidate measurements and later capture-boundary revisions on separate hashes;
changed hash/query work cannot use the serial-versus-reader equality assertion.
See docs/WANTED_CLOSED_RECEIPT_GROUP_OUTCOME.md for scope and mixed heap/timing.

Guarded workload profiling belongs in an explicit benchmark, not an automatically
repeated large scaling suite. Compare full results/projection digests privately
on one connection with a fresh rollback-owned transaction per sample. Include
real maintenance/write/link/source-event guards; distinguish their seven rereads,
distinct bindings per projection and duplicate historical receipts. Separate
setup/GC/rollback from elapsed work, record sampled memory fields independently,
and retain mixed timing/heap results. Never infer grouping authority from duplicate
counts. See docs/WANTED_GUARDED_WORKLOAD_OUTCOME.md for bounded plans and proof.

Checkout diagnostics must observe promise and callback acquisition on owned pool
instances, including pool.query's callback path, without eager app-pool creation.
Keep admission-phase context isolated through nested/concurrent work even when
timing is off. Record dispatched counters before awaiting first-failure capture,
retain Error/null, drain capture and restore descriptors before cleanup. Bounded
records/probes and healthy snapshots do not diagnose historical timeouts; native
controls must separate cold connection failure from observed queue pressure.
See docs/POSTGRES_CHECKOUT_CAPTURE_OUTCOME.md for scope and separate gate evidence.

Reusable-file validation must prove one bounded buffer, short reads/poisoned
tails, captured descriptor/path identity, early EOF/growth and awaited close with
primary Error/null preserved. A same-size/same-time replacement must refuse before
byte observation when descriptor identity differs. Keep actual root/path rechecks
and publication refusal/replay; internal stream/64 KiB remains a comparator.
See docs/TRACK_FINGERPRINT_REUSABLE_OUTCOME.md for qualified memory/timing and
default composition proof. Isolated hash benefit is not whole-Wanted/CI proof.

Fingerprint buffer validation needs actual file/hash/byte equality for each
bounded option, changed-file/private-root refusal and delayed success/Error/null
close controls. Treat high-water marks as thresholds and sampled process peaks
as observations; do not sum external and ArrayBuffers or promote elapsed time
alone. Isolated probes own close/termination and retain files after unverified
quiescence. Keep hash-only profiling separate from real apply/Wanted guard proof
and whole-app/CI claims. See docs/TRACK_FINGERPRINT_STREAM_OUTCOME.md; targeted
large-media integration proof can avoid repeating an unchanged full scaling
experiment when it adds no new authority evidence.

Root-lookup profiling must retain identical projections and actual hash/byte work
with alternating samples on one borrowed client. Historical duplicate receipts
are not distinct-track acquisition coverage. Keep query counts separate from
whole-projection speed and nested phase totals. Register actual app-scenario
completion beyond test-runner timeout, close new query/hash admission, drain and
retain original Error/null before fixture disposal. Avoid redundant warm-ups
when real apply already hashed the media; preserve timed samples and existing
resource bounds. See docs/WANTED_ROOT_LOOKUP_OUTCOME.md for the failed initial
largest profile and separately reviewed/frozen evidence.

For negative receipt scans, prove the production module captures before its actual
walk, compares original acquisition/revision/root, and checks contained ENOENT
after required events. Test newer receipts, restored bytes, current-root changes,
lease/cancellation, event rollback and replay/snapshot FK cleanup. Windows receipts
may use process-drive-rooted paths while walks return drive-qualified paths;
lookup must select both and host containment remains the authority. Keep current
byte verification, maintenance pause and exact scan/acquisition event correlation.
See docs/SCAN_RECEIPT_INVALIDATION_OUTCOME.md; pure injected input does not prove
production wiring or that old negative history cannot suppress restored media.

For indexed receipt work, prove the actual pending migration backfills supported
history without dropping a malformed peer into a partial grant. Verify source
transaction/event rollback, replacement/status/deletion, owner isolation and
snapshot-installed trigger behavior. Compare identical legacy/indexed results
on the same seeded database with planner-chosen EXPLAIN/buffers; no forced index
or elapsed-time assertion. SQL lookup timing excludes media hashing and whole
Wanted work. See docs/OPERATOR_TRACK_RECEIPT_LEDGER_OUTCOME.md; keep current byte
verification until a scan-owned availability contract is independently proved.

Direct database fixtures now enforce the same integration pool policy as app
fixtures, including template preparation/clones. Verify actual max/checkout
settings instead of assuming documentation applies. Legacy direct pools omitted
that policy; preserve their failed evidence rather than comparing changed pool
pressure as a matched speed benchmark. Abandonment checkpoints register actual
completion, race failure/cancellation, release gates and drain before database
teardown. Failure-only version-two records separate independent host/query,
container readiness and bounded state. Healthy snapshots do not diagnose a
previous ECONNRESET; controlled 57P01 termination proves failure handling only.
See docs/POSTGRES_FIXTURE_RESET_DESIGN.md and its outcome. No retry, deadline
increase, global parallelism or skip should convert a failed cohort into green.
If a lock test holds both clients, use fixture-postgres-observer.js with the
acknowledged scenario connection config; never request a third checkout to
observe its own wait or spread internal pool.options. Observe expected rejection
immediately and unlock/drain holders and publishers before database teardown.
Keep matched-order shared-runner adoption separate from claims about a reset fix.

For two-owner unions, prove actual saved intent creates two owned requests but
one discovery row, then one exact two-file provider manifest. Verify distinct
private deliveries, untouched extra/sibling tracks, retained shared input,
current primary ownership in either direction, missing/disabled/late participants
and changed roots. Use the owning queryable for quality rechecks and receipt
publication. Required-event failure must roll back both receipts and status;
replacing one delivered file restores only that owner's Wanted requirement.
Keep pre-fix intake/staging diagnostics separate from frozen final proof. See
docs/OPERATOR_TRACK_UNION_OUTCOME.md. Bounded partial recovery now requires the
actual worker/run retry, one committed first-delivery checkpoint, both captured
plans, current lease/consent/catalog/root, unchanged first bytes and mutation of
only the unresolved recipient. Prove required-source-event rollback, lease expiry
after a checkpoint event, private-directory redirection refusal, no provider
dispatch and owner-specific source/Wanted reopening after byte loss. See
docs/OPERATOR_TRACK_RECOVERY_OUTCOME.md. Same-file sharing, larger/multi-disc
unions and unrecorded restart/adoption/origin recovery remain conservative.

For track requirements, prove current recording/medium/track-position membership,
unsupported track MBIDs, incomplete desired sets, exact scope persistence and
post-plan catalog changes with real saves and guarded publication. For the
supported one-track/disc-one subset, prove the completed worker's exact provider
manifest, actual media identity/duration, untouched sibling, late consent refusal,
atomic receipt/event rollback and replaced-file Wanted restoration. Global
complete/duplicate counts must not suppress a person's typed subset. Keep other
subset shapes blocked before provider/file work. Test explicit null
markers, mixed participants and legacy candidates against current requirements;
do not infer permission from filename scores. Forward the owned queryable during
recovery and prove standalone medium/recording/track writers block after final
publication checks. See `docs/OPERATOR_TRACK_SUBSET_OUTCOME.md` and the preceding
catalog outcome. Keep initial
red, fixture failures and pre-review passing gates separate from final evidence.

Track-consent validation must distinguish suppression and declared resolved
desire, remap review/orphan state, and binding to the selected edition. Keep
descriptive counts while deriving resolvedDesiredCount; old total/desired counts
cannot grant a fallback exception. Native saves must use valid identities and
current revision, read Wanted on an owned transaction, and inspect durable
requests/events/discovery after actual completion/close. Forge eligibility and
explicit flags against unchanged suppression source to test the SQL guard.
Preserve bound/unbound desired intent, independent manual release selection and
normal broad policy. Reuse operator-reconciliation-execution-fixture.js for these
owners; claim completion alone is insufficient. See
`docs/OPERATOR_TRACK_CONSENT_OUTCOME.md`. Declared remap state is not live catalog
membership or downstream per-track enforcement; trace those separately.

Monitoring opt-out tests must save false through the canonical save and execute
the queued current snapshot, awaiting actual worker completion/close before
reading durable request/event/discovery rows. A forged eligible flag against
unchanged unmonitored source must also refuse in the real publication transaction.
Check direct Wanted projection, positive monitored explicit consent, existing
request preservation and primary blocker counts. Keep normal save validation:
explicit selections/overrides require monitoring; nonempty release types are
required. Build Wanted readers on an owned transaction queryable. Preserve the
initial red reproduction and fixture corrections separately from final proof.
See `docs/OPERATOR_MONITORING_OPT_OUT_OUTCOME.md` for that slice's evidence;
the subsequent track-consent outcome owns the native suppression reproduction.

Metadata source writer tests should hold publication after its final check,
observe real PostgreSQL blocking for absent selection/override/snapshot and
catalog/bulk writers, then drain both publication and writer before teardown.
Use an independent observer from owned connection config; normal read progress
must not require a third app checkout. Verify a different operator scope can
still progress, borrowed autocommit refuses, caller rollback owns borrowed work,
and failed canonical setting restores the original winner. Capture DTO mutation
during admission at the lowest owner. See
`docs/METADATA_SOURCE_WRITER_COORDINATION_OUTCOME.md` for scope and gate evidence.

The writer-coordination cohort also exposed two legacy fixtures borrowing a pool
as an active transaction client. Keep autocommit refusal and correct their owner
or let the store own the transaction; do not weaken the assertion. Retain the
102/104 candidate and 2/2 focused correction separately from final native proof.

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

Metadata history's three-engine/native tab-zoom proof is explicit:
`npm run validate:metadata-history-compatibility`. It is outside the routine
browser glob. See docs/METADATA_HISTORY_COMPATIBILITY_DESIGN.md for actual zoom
versus reflow, browser setup/retirement ownership and remaining manual AT checks.

For the operator handoff, `npm run manual:metadata-history` starts the isolated
desktop session. Qualify its real HTTP/database/UI states explicitly with
`npm run validate:metadata-history-manual-fixture`; this is outside routine
browser/fast globs and does not prove speech or physical-device acceptance.
See docs/METADATA_HISTORY_MANUAL_FIXTURE_DESIGN.md for the fresh database,
server route restrictions and held-read retirement boundary.

For manual-session cancellation, keep early quit/EOF child-process checks and
native Docker acknowledgement/retirement in that explicit lane. Register stdin
release and actual child close before waiting; retain input/OS-signal coverage
limits. Controlled Docker gates must drain before exact removal, including
expected stop plus cleanup Error/null. See docs/MANUAL_SESSION_CANCELLATION_DESIGN.md.

For actual Linux SIGINT/SIGTERM input/runner proof, use the conditional
[signal reference](references/manual-session-signals.md). It owns the explicit
isolated lane, child/stdio close and distinction from full database shutdown.

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
release-reconciliation/tag-snapshot/Music Queue recovery transaction/execution/
discovery cohort. It owns one fresh server, preserving
isolated file processes, databases
and pools. The default complete gate is unchanged. Do not expand its allowlist
until every fixture-created database has the parent reserve/CREATE/OID commit
contract. Raw Dockerized fixtures and manually created siblings require separate
ownership work. Close admission, observe the actual child close and known-worker
absence, then reconcile before the next file. A signal acknowledgement or reporter
end is insufficient. Unknown/replacement identities are refusals, not prefix-based
cleanup targets. See `docs/POSTGRES_TEST_LAUNCHER_DESIGN.md` and its outcome for
measured scope and process/platform limits.

The initial Wanted/recovery adoption retained Wanted's private template and
recovery's empty migration path. Current scoped transaction/execution/discovery
template policies and separate evidence are in references/guarded-workload-selection.md.
Register the scan fixture's actual completion before launch;
lease-release observation is earlier. Drain competing returned recovery work
through first Error/null. Close parent admission before failure diagnostics,
then capture only the acknowledged fresh server's independent query/readiness/
state before reconciliation/disposal. Child native failure remains the original
evidence. Measure matched code/order/reporters/image/schema/bounds and report
command versus adapter wall separately; one baseline-first pair is not a CI
speedup. See docs/WANTED_RECOVERY_SHARED_POSTGRES_OUTCOME.md. Further allowlist
expansion still needs creation/ownership/drainage proof; no global parallelism,
cross-run reuse or other recovery schema caching is implied by that initial adoption.

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

For complete opt-in orchestration, use `npm run test:integration:coordinated`
and inspect `-- --plan` first. The complete canonical file inventory must be
covered exactly once: one reviewed shared cohort, then sorted isolated files.
Require native root evidence with zero skips and shared release before completed
publication; clear inherited database/parent credentials and cross-run reuse.
The coordinator's preflight requires immutable local media/reader IDs, inspected
Linux identities, five fixed tool versions and the reviewed PostgreSQL 18 Alpine
reference (resolved to a verified digest). Await acknowledged probe retirement
before database work; --plan performs no Docker work. See
docs/INTEGRATION_PREFLIGHT_OUTCOME.md for full-command and refusal evidence.
See references/guarded-workload-selection.md for ownership and failure limits.

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
