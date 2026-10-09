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
| Shared discovery dispatch | `src/server/library/library-discovery-run-service.js`, discovery run/request stores and worker | Concurrent starters create/coalesce correctly; all relevant producers participate in any claimed coordination boundary. No shared history/quality reset merely to dispatch. |
| Queued file mutation | `src/server/import-candidates/import-candidate-apply-worker.js`, safe-auto quality gate, apply operation, media filesystem service | Capture current candidate/policy/provenance before awaited preview preparation; compare again immediately before mutation. Delay preview and change provenance to expose a late snapshot that would compare changed state with itself. A measured preview source does not verify preexisting staging/reuse bytes; exercise actual final-input refusal or verification with test-owned files. |
| Public refreshed facts | `src/server/missing-music/missing-music-decision-service.js`, detail normalization/presentation | Permission and worklist classification agree with guarded policy; public data contains no provider paths/bodies, raw SQL errors, or secret material. |

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
