# Project standards-to-evidence map

Paths below are in the active Harmoniarr repository, not bundled skill files.
Inspect current source; the map locates owners and does not replace source
tracing. Read the relevant boundary only.

| Boundary | Existing owners | Useful counterexample/evidence |
| --- | --- | --- |
| Search results to automatic download | `src/server/import-candidates/music-queue-recovery-discovery-handoff-service.js`, handoff store, library discovery dispatcher | Trace every later side effect after awaited search/ingestion/readiness. A pre-search guard or zero-result fixture does not prove positive automatic continuation. Exercise actual persisted ingestion/scoring and atomic search/selection/typed-child/audit ownership; the child must recheck before enqueue. |
| Rendered Missing Music command | `src/client/router.js`, `src/client/components/missing-music/MissingMusicDecisionInspector.vue`, `src/client/views/MissingView.vue` | Reach the action from the default worklist, activate with Enter/Space, retain visible/unobscured focus in narrow layouts. |
| Feedback and focus during async work | Inspector, `useMissingMusicDecisionDetail.js`, `useMissingMusicDecisionMutation.js` | Pending status exists before text update and has no busy ancestor; moving focus elsewhere during a request is respected; background refresh does not move focus. |
| Interaction-owned focus after rendering | `src/client/lib/user-command-focus.js`, inspector command completion | Capture the invoker before disabling/removing it; body focus caused by removal retains ownership, while an explicit move to another control revokes it. Test both outcomes in the browser. |
| Native confirmation and pending feedback | `src/client/components/missing-music/MissingMusicLibraryAddAction.vue`, inspector, modal/focus helpers | An outside status region is inert while a native modal stays open. Verify exposed pending feedback at the chosen timing, Cancel/Escape without mutation, and owned focus return after closure or uncertain failure. |
| Request intent and uncertain retries | `src/client/lib/missing-music-api.js`, `retry-idempotency-key-store.js`, command composables | A lost response retries the same intent key; a changed decision/command invalidates feedback and prior intent appropriately. |
| Server authority and current eligibility | `src/server/routes/missing-music-routes.js`, `src/server/missing-music/missing-music-decision-target-service.js`, narrow action policies/services | Requester/operator own scope, administrator household scope, disabled history, stale state, and browser-forged target fields. |
| Durable replay and guarded writes | Existing idempotent mutation services; `src/server/library/` service/store boundaries | Same-key replay, different-key coalescing/no-op, required-audit rollback, maintenance/account/worker races. Use real PostgreSQL for SQL-owned claims. |
| Delayed automatic authority | `src/server/import-candidates/import-candidate-music-queue-auto-safe-add-service.js`, owning apply run store, shared safe-add worker policy | Persist automatic classification independently of mutable candidate context. Retain bounded accepted physical identity in the owning run; delete context/ownership or retarget another participant before startup and prove refusal before file changes. Current participant membership alone does not preserve an accepted physical recipient. |
| Delayed recovery and truthful progress | `src/server/import-candidates/music-queue-recovery-service.js`, recovery store/execution policy, `src/server/library/library-music-queue-recovery-discovery-service.js`, acquisition pipeline projection | One durable source-run/candidate attempt owns competing terminal observations and child intent. Remove consent or change scope during awaited preparation and prove refusal before provider work. Retire only the still-owned known-undispatched intent; preserve uncertain dispatch and newer decisions. Pending matches, historical transfers or a refused child's old search deadline alone must not imply queued/running work. Use real PostgreSQL for ownership/rollback and a production-derived browser flow for public status/focus. |
| Attempt-owned provider receipts | `src/server/slskd/slskd-download-attempt-policy.js`, handoff reconciliation, import execution handoff transaction, execution summary/public projection | Inspect the supported provider version before assuming its replay contract. A same-file history row or a newly observed ID does not identify its caller. Legacy lost responses without a durable direct receipt stay unresolved. Validate exact peer/file/size/unique ID and current run/item/attempt; partial or malformed receipts and incomplete live observations must not appear completed. Keep private evidence out of APIs and unresolved checkpoints out of retention deletion. A local enqueue receipt proves admission, not remote completion; a batch record alone likewise does not prove every file was admitted. |
| Caller-ID batch and exact receipt observation | `src/server/slskd/slskd-download-dispatch-service.js`, batch/evidence/protocol policies, transfer snapshot, execution worker/summary | Pin the source-verified version and endpoint before dispatch; delay the version probe and change endpoint/credentials. A batch can exist before file admission: require the exact whole saved manifest and actual positive per-file evidence for lookup recovery. Missing/malformed bodies, local-only queued rows, duplicate/foreign IDs, restart markers and a wrong explicit binding stay unresolved. Exact ID reads can verify removed successful rows without filename discovery. Keep a durable rejection after resume and isolate unavailable individual observations. |
| Explicit adoption of uncertain downloads | `src/server/import-candidates/import-candidate-download-adoption-service.js`, adoption store/policy, common execution adoption transaction, `ImportCandidateDownloadAdoption.vue` | An operator's fresh whole-manifest choice is separate from proof of the original POST. Require current administrator/session/CSRF, source/scope/quality and latest eligible ownership; a review digest is freshness, not authorization. Refuse competing same-file IDs or another episode's links. Race account/consent/maintenance changes around provider reads and required audits using real PostgreSQL. Replay a lost response without another provider command or duplicate audit. Preserve original uncertainty through restart/failure/retention and later automatic recovery; exercise native Cancel, exposed pending status, route-change focus and canonical refreshed facts in the browser. |
| Older verified work blocked by a newer allocation | `src/server/import-candidates/import-execution-origin-{policy,sql,store}.js`, download-origin service, allocation/item/lifecycle owners and restored worklist | Cancellation or an empty history does not prove non-dispatch. Verify the one exact unused allocation, full older batch and current authority; retire and confirm under shared candidate/run/item/lease fences. Reciprocal records must match actual source attempt and survive every reader, retry, stale worker write and both retention paths. A late source snapshot needs a resolution-ID comparison too: matching its old attempt ID alone can erase the new pair. Race R2 claims and R3 allocation, roll back required audits and preserve current positive tracking through completion. Inspect actual module exports and invoke handlers; isolated route mocks cannot prove startup wiring. |
| Abandoned future preparation closure | `src/server/import-candidates/import-execution-preparation-closure-{policy,service,store}.js`, bounded confirmation reconciliation, final native beforeSend, lifecycle/retry writers | System closure is distinct from administrator restoration. Close only the exact idle future preparing epoch under a fresh closure lease and ordered locks; cancellation, expiry and provider absence alone are insufficient. Refresh authoritative time after lock waits rather than relying on transaction-start NOW. Parent downloadPreparationClosure must match epoch.closure; even malformed parent-marker presence blocks ordinary reactivation. Hold an old native callback across closure and prove zero POSTs; crossing-first, live/same-owner leases, source changes, audit rollback and stale writes must refuse or retain uncertainty. Hide raw markers/epochs; a public preparationClosed flag inhibits Retry but grants no restoration authority. |
| Acquisition-owned lease callbacks | `src/server/job-lease-policy.js`, job-lease store, operation-run bridge, shared lease heartbeat, fourteen worker factories, stranded recovery and closure lease SQL | Stable row ID, PID and timestamps do not distinguish acquisitions. Capture the returned private acquisition UUID once and thread expectedLease to heartbeat, lifecycle and final release; never fetch the newest token to authorize an old callback. Null renewal is lease loss; false start stops before domain work, and false completion stops later notifications. Race old heartbeat/release/terminal callbacks against same-owner reacquisition, including an in-flight timer after stop. Verify public lease allowlists and nested redaction while keeping existing state/expiry/row identity. Tokens fence local lease/lifecycle writes, not external effects already in progress. |
| Additive lease identity schema | `scripts/create-migration.js`, `scripts/schema-snapshot.js`, `src/server/schema-anchor-service.js`, `src/server/schema-snapshot.sql` | Add the acquisition column through migration:create, regenerate with update:schema-snapshot and test migrated versus fresh snapshot/anchor agreement. Keep stable row identity; new acquisitions rotate only their token. Backfill does not graft authority into historical captured frames. Stop old key-only binaries before rollout; a new column cannot fence their old SQL. Record the default/backfill migration lock cost and use actual PostgreSQL for takeover/expiry/rollback claims. |
| Shared discovery dispatch | `src/server/library/library-discovery-run-service.js`, discovery run/request stores and worker | Concurrent starters create/coalesce correctly; all relevant producers participate in any claimed coordination boundary. No shared history/quality reset merely to dispatch. |
| Queued file mutation | `src/server/import-candidates/import-candidate-apply-worker.js`, safe-auto quality gate, apply operation, media filesystem service | Capture current candidate/policy/provenance before awaited preview preparation; compare again immediately before mutation. Delay preview and change provenance to expose a late snapshot that would compare changed state with itself. A measured preview source does not verify preexisting staging/reuse bytes; exercise actual final-input refusal or verification with test-owned files. |
| Library organize mutation | `src/server/library/library-organize-mutation-{policy,service,store}.js`, organize worker, `src/server/media/media-filesystem-service.js` | Capture the original acquisition and immutable file/root/source/destination before awaiting work. Recheck after native inspection before mkdir, copy/link and verified source removal; fallback must carry the guard and never reinterpret its refusal as a transport error. Use short current-owned transactions and fresh time after waits, then an old-path/root catalogue CAS whose zero-row result refuses success. Exercise late lease, cancellation, maintenance and source drift, preserved source after post-copy refusal, real exclusive copy/remove/path success and no stale notification. Local guards neither roll back completed filesystem steps nor hold authority throughout I/O. Keep generic transport defaults unchanged. |
| Public refreshed facts | `src/server/missing-music/missing-music-decision-service.js`, detail normalization/presentation | Permission and worklist classification agree with guarded policy; public data contains no provider paths/bodies, raw SQL errors, or secret material. |
| Scan observation to catalogue commit | `src/server/library/library-scan-catalogue-{policy,service,store}.js`, scan worker, `library-catalog-store.js` | Capture scalar observations and the original acquisition before awaiting the owning transaction, including mutable Date values as ISO text. Carry requested and realpath-resolved roots separately. Maintenance, run/key/lease, root and file writes use the same client and compatible order; await guards before root upsert, every batch and tombstones, then recheck fresh authority immediately before commit. Stale empty scans must not tombstone replacement observations, while a current empty successful walk remains valid. Exercise lock-wait expiry, final-guard rollback, incomplete results and zero extra connection; downstream tag/artwork/reconciliation are separate owners. |
| Parsed tags to snapshot and current file | `src/server/library/library-tag-snapshot-{policy,service,guard-store}.js`, tag extraction, `library-tag-snapshot-store.js` | Capture the original acquisition and immutable file/root/path/size/nullable mtime before parsing, then copy the parser payload before awaited SQL. Source stamps record accepted input; they do not replace a current-source CAS. Append history and update the current observed/nondeleted file in one client transaction with current guards and fresh time, checking exact returned identities and affected rows. Parser failures may persist once under the same guard; ownership, source and persistence errors must never become a failed-snapshot fallback or start artwork. Race source/token/maintenance/cancellation and final checks; preserve platform filename positives beside traversal negatives. This is catalogue-source comparison, not a content hash or atomic filesystem snapshot. |
| Metadata lookup to current file match | `src/server/library/library-file-match-{policy,service,guard-store}.js`, matcher, raw match store | Capture every observed source, nullable tags and relevant release scope before lookup; preserve strategy/confidence outcomes. Compare JSON objects by value independent of key order, arrays by order, and SQL NULL distinctly from an empty object. Re-derive each scope from the locked run's relevant hints rather than comparing the entire summary or trusting a preexisting scope. Guard one atomic batch with the original acquisition, same client and fresh clock; exact unique returned IDs and source/tag CAS must cover inserts and updates. One stale sibling or final refusal rolls back the batch. Matching does not fence earlier artwork or freeze metadata candidates. |
| Global coverage to release projection | `src/server/library/library-release-reconciliation-{policy,service,guard-store,lock-store}.js`, coverage SQL store and raw projection writer | Admit the original scan context under one projection key, explicitly set READ COMMITTED before reads, and obtain initial coverage inside the owner after waits. Re-read the whole aggregate before DELETE, bulk upsert and commit; other roots/new rows matter when they change coverage. Refuse drift rather than adopting it mid-pass, verify exact deleted and persisted identity sets, and roll back all mutations together. A current empty aggregate still performs cleanup. Projection admission serializes cooperating replacers, not source producers: each query sees committed coverage at its snapshot, while a source commit after the final read may require another pass. Existing-row or advisory locks alone do not prove phantom or strict commit freshness. |
| Saved intent to wanted rows and discovery links | `src/server/library/library-wanted-release-{service,reader,reconciliation-policy,guard-store,write-store}.js`, shared request-projection lock and raw discovery replacement | Preserve distinct scan/discovery/metadata worker authority, omitted-context direct rebuild and authorized raw restore; present malformed context never falls back to direct mode. Capture nested policy/metadata/selection/override inputs before later waits and compare both source and output, excluding only verified housekeeping. A profile change can matter with identical wanted rows. Preserve exact user/release pairs and stable retained row IDs; build every bulk array from the same rows. Required link synchronization shares the transaction, including empty cleanup, and failure/final drift rolls back all rows and links. Both publishers acquire admission before parent mutations. Tolerate exact metadata404 only at the artist read; source snapshots are component reads, not one global instant or acquisition authority. |

Use project canonical-actions guidance for full action ownership/refresh, and
scoped-overrides guidance when changing a recipient's policy exception. This
skill provides the standards/applicability/evidence layer rather than duplicating
their domain contracts. Follow the project's testing-validation guidance and
current package scripts for the affected paths.

A compact report can map `practice -> owner -> adverse case -> executed evidence`.
For example, status guidance maps to the inspector's live region and a delayed
mutation/browser observation. That demonstrates DOM behavior; screen-reader
announcement remains unverified unless tested with an actual assistive technology.
Keep provider fixtures, real transactions, browser behavior, package execution,
and published-artifact acceptance distinct.

For assembled services, trace top-level dependency overrides as well as factory
defaults and route exports. Exercise the native callback that is actually
supplied; a working lower-level exact reader does not prove the app uses it.
Inside an owning transaction, local settings/credential assertions must use its
client instead of reentering the pool; include a real one-connection control.
When private observation slices share a run, merge their distinct item identities:
deduplicating by run alone can silently drop pending or restored work.

For negative dispatch evidence, trace the final native send rather than assuming
an earlier guard is the boundary. New preparation epochs can seal only while
still preparing; a durable crossing/commit-ack loss stays unknown even if a POST
never began. Compare complete epoch state across stale writers and retry leases,
preserve it through retention, and never backfill old absence as proof. Check raw
repository snapshot aliases as well as the canonical projected field: a sanitized
planningSnapshot does not remove a sibling snapshot carrying the same private data.

For infrastructure API changes, search production, scripts and test fixtures for
every retired interface. Restore/continuity scaffolding is part of that inventory.
Preserve its exact ledger, cancellation and zero-external-effect assertions while
supplying genuinely captured ownership and transaction clients. A passing owning
suite does not replace the complete application validation command; retain the
first broad failure and rerun that same command after the focused correction.
When adding catalogue locks, include ordinary scan upsert/tombstone writers in
the lock-order trace. Coordinate real root/file waits by blocking PID; joined
queries or short transactions alone do not establish compatible acquisition order.
For scan capture, compare containment and relative-path formatting with the actual
walker. Positive contained double-dot and POSIX backslash filenames belong beside
parent-traversal negatives; freezing an observation must preserve its identity.

For restore/bulk identity checks, compare PostgreSQL UUID values rather than their
input spellings. Uppercase, braces and omitted hyphens can return as canonical
text; normalize accepted raw identity before pair deduplication and expected-set
construction. Exercise canonical SQL-return doubles beside alias inputs and retain
last-value behavior. This compatibility normalization does not relax stricter
worker acquisition or live-source validation.

Same-client ownership does not prove safe query scheduling. Trace nested reader
calls as well as outer artist loops; await operations on a transaction client
according to its driver contract. Use a delayed nonreentrant client double with
multiple artists and the actual narrow metadata composition to catch overlapping
queries that ordinary async mocks hide. Keep capture immediately after each
read before awaiting the next input; pool-level concurrency is a different owner.

Fixture diagnostics map to `testing/reporters/early-failure-format.js` and the
streaming adapter beside it; timing maps to
`testing/integration/fixture-phase-observer.js`. Controlled readiness, cancellation,
release and drain map to `fixture-lifecycle.js`; verified backend cleanup maps to
`postgres-backend-drain.js` and the temporary-database helper's creation guard.
The observed scan adapter is `testing/integration/library-scan-worker-fixture.js`;
register completion before launch and reject pre-aborted or refused registration
without starting detached work. Startup failure must settle the registered drain.
Use native held-case reporter proof, error/privacy canaries, deterministic clocks,
release/drain failure controls and real isolated PostgreSQL ownership beside
structure checks. The separate fixture-observability outcome owns executed claims.

Prepared-schema admission maps to `migration-template-inputs.js`,
`migration-template-preparation.js`, `postgres-template-store.js` and
`postgres-migration-template.js` under `testing/integration/`. Trace actual
lineage/profile, private source sealing, fresh clone ownership and strict cleanup.
Use real rows/triggers/leases, source connection denial, fingerprint drift and
replacement-OID/sibling controls beside unit evidence. Dedicated fresh migration
and snapshot-bootstrap proof remain separate; nested creation/admission spans
must not be added twice. The template outcome owns measured/complete-gate claims.

Parent-owned serial sharing maps to `postgres-test-launcher.js`,
`parent-postgres-registry.js`, `parent-postgres-store.js`,
`parent-postgres-control-server.js` and `parent-postgres-client.js` under
`testing/integration/`. `postgres-file-process.js` owns native CLI close/output;
`owned-process-tree.js` targets only its actual spawned root. Follow reserve,
CREATE/OID acknowledgement, child close, known-worker absence and reconciliation
before the next file. Real abandoned-child, cancellation, uncommitted and
replacement canaries live in `test/integration/parent-postgres-launcher.test.js`.
The launcher outcome separates cohort timing from full-gate coverage and
platform limitations; do not expand its explicit cohort from a passing benchmark.

Audited release/tag fixture lifetimes map to `fixture-work-scope.js`,
`fixture-workspace.js`, `fixture-transaction-client.js` and the two domain worker
fixtures under `testing/integration/`. Tag's reusable scenario owns native media
and database/workspace ordering. The two `library-*-fixture-lifecycle.test.js`
files verify actual SQL rollback, captured lease release and held native-parser
cancellation before writes. The original serialization tests additionally fence
their borrowed idle-client reads before rollback. The separate cohort-adoption
outcome owns executed counts, matched-order measurements and scope limits.
