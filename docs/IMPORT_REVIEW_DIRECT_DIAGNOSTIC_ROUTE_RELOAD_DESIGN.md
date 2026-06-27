# Import Review Direct Diagnostic Route Reload Verification

Status: Implemented

## Context

Import Review diagnostic handoff is already covered when an operator clicks a
media-inspection diagnostic row. The remaining durability gap is direct entry:
an operator can reload or share a URL containing `candidate`, `candidateFile`,
and `mediaInspectionRunId` route state plus the selection-stage hash. That path
must hydrate the same candidate detail, focused file row, and selected
historical media-inspection run without depending on the original click event.

## Official Guidance Reviewed

As of June 2026:

- Playwright recommends locator-first, user-visible assertions with built-in
  actionability and auto-waiting: <https://playwright.dev/docs/actionability>
- Playwright navigation guidance supports explicit direct navigation and reload
  checks instead of interaction-only setup: <https://playwright.dev/docs/navigations>
- Vue Router recommends using Composition API route access and watching the
  specific route properties a component expects to react to:
  <https://router.vuejs.org/guide/advanced/composition-api>
- MDN documents `URLSearchParams` as the standard query-state API:
  <https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams>
- OWASP authorization guidance recommends deny-by-default, server-side
  authorization checks: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Treat Import Review diagnostic context as a URL contract:

```text
/app/activity/candidates?candidate=<candidateId>&candidateFile=<fileId>&mediaInspectionRunId=<runId>#import-review-selection-stage
```

The client should normalize the query through the existing route-state helper,
load the selected candidate through the normal Import Review workspace
composable, load the selected media-inspection run through the admin runway
workflow, and let `ImportCandidateDetailPanel` own file focus once the file row
exists.

Do not add a diagnostic-only session cache or reload recovery store. Reloads
should be proven through the same route-state, API, and focus paths used by the
production view.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Verify direct URL plus reload in one browser scenario | Proves the durable route contract and catches hydration regressions | Adds one browser scenario |
| Rely on click-driven diagnostic handoff tests | Keeps test count lower | Misses shared-link and reload failures |
| Add session-backed diagnostic context | Could recover some incomplete URLs | Makes state less shareable and risks stale diagnostic context |
| Keep route query as the source of truth | Back-button/share-link friendly and easy to inspect | Requires strict query normalization and focused browser coverage |

## Final Stack

- **Route contract:** `candidate`, `candidateFile`, and `mediaInspectionRunId`
  remain explicit public query keys; the selection hash anchors the candidate
  detail workspace.
- **Hydration path:** `useImportReviewWorkspace` opens the route-selected
  candidate, while `useImportReviewAdminWorkflow` loads the route-selected
  media-inspection run.
- **Focus path:** `ImportCandidateDetailPanel` focuses and highlights the
  routed `candidateFile` after candidate files render.
- **Security posture:** the URL carries opaque IDs only. Candidate detail, run
  detail, and management actions still go through the existing role-gated API
  paths; raw probe output and private diagnostics remain out of route state.
- **Browser verification:** `test/browser/import-review-direct-diagnostic-route-reload-browser-verification.test.js`
  opens the route directly, verifies hydrated candidate/run/file focus state,
  reloads the browser, and verifies the same state again.

## Outcome

- Direct diagnostic URLs hydrate the selected Import Review candidate.
- The affected file row is highlighted and receives focus on first load and
  after browser reload.
- The selected historical media-inspection run remains selected while the
  candidate detail route hash is preserved.
- The fixture path continues to reuse shared diagnostic Import Review workspace
  builders instead of duplicating candidate/run payloads.

## Follow-Up

Completed in `docs/IMPORT_REVIEW_DIAGNOSTIC_FIXTURE_PACK_CONSOLIDATION_DESIGN.md`.
The next high-value item is queued-worker maintenance-lock pause proof, because
the Import Review diagnostic browser suite now has stable fixture coverage and
the remaining release risk is operational safety while maintenance is active.
