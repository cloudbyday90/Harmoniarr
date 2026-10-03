# Project standards-to-evidence map

Paths below are in the active Harmoniarr repository, not bundled skill files.
Inspect current source; the map locates owners and does not replace source
tracing. Read the relevant boundary only.

| Boundary | Existing owners | Useful counterexample/evidence |
| --- | --- | --- |
| Rendered Missing Music command | `src/client/router.js`, `src/client/components/missing-music/MissingMusicDecisionInspector.vue`, `src/client/views/MissingView.vue` | Reach the action from the default worklist, activate with Enter/Space, retain visible/unobscured focus in narrow layouts. |
| Feedback and focus during async work | Inspector, `useMissingMusicDecisionDetail.js`, `useMissingMusicDecisionMutation.js` | Pending status exists before text update and has no busy ancestor; moving focus elsewhere during a request is respected; background refresh does not move focus. |
| Interaction-owned focus after rendering | `src/client/lib/user-command-focus.js`, inspector command completion | Capture the invoker before disabling/removing it; body focus caused by removal retains ownership, while an explicit move to another control revokes it. Test both outcomes in the browser. |
| Request intent and uncertain retries | `src/client/lib/missing-music-api.js`, `retry-idempotency-key-store.js`, command composables | A lost response retries the same intent key; a changed decision/command invalidates feedback and prior intent appropriately. |
| Server authority and current eligibility | `src/server/routes/missing-music-routes.js`, `src/server/missing-music/missing-music-decision-target-service.js`, narrow action policies/services | Requester/operator own scope, administrator household scope, disabled history, stale state, and browser-forged target fields. |
| Durable replay and guarded writes | Existing idempotent mutation services; `src/server/library/` service/store boundaries | Same-key replay, different-key coalescing/no-op, required-audit rollback, maintenance/account/worker races. Use real PostgreSQL for SQL-owned claims. |
| Shared discovery dispatch | `src/server/library/library-discovery-run-service.js`, discovery run/request stores and worker | Concurrent starters create/coalesce correctly; all relevant producers participate in any claimed coordination boundary. No shared history/quality reset merely to dispatch. |
| Queued file mutation | `src/server/import-candidates/import-candidate-apply-worker.js`, safe-auto quality gate, apply operation, media filesystem service | A measured preview source does not verify preexisting staging/reuse bytes. Exercise actual final-input refusal or verification with test-owned files at the worker/operation boundary. |
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
