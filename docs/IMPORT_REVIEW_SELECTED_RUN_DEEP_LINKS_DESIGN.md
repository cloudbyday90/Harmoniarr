# Import Review Selected-Run Deep Links And Historical Run Detail

## Context

Import Review runway panels now support starting media inspection, download,
and import apply runs. The next route-state risk was historical run inspection:
operators need shared URLs and row selection to load the intended run detail
instead of silently falling back to the latest/current run.

## Official Sources Reviewed

- [Playwright locators](https://playwright.dev/docs/locators): prefer
  user-facing role/text locators when the visible role or text matters.
- [Playwright auto-waiting](https://playwright.dev/docs/actionability):
  actions wait for visibility, stability, event-receivability, and enabled state.
- [Playwright best practices](https://playwright.dev/docs/best-practices):
  resilient tests should verify behavior through the user-visible surface.
- [Vue Router programmatic navigation](https://router.vuejs.org/guide/essentials/navigation.html):
  `replace` updates route state consistently across history modes.
- [W3C WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html):
  keyboard users need to know which element has focus.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  authorization must remain robust, maintainable, and server-enforced.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html):
  security-relevant state transitions and ownership decisions should be derived
  and validated server-side.

## Recommendations

1. Keep selected run IDs in route query state:
   `mediaInspectionRunId`, `executionRunId`, and `applyRunId`.
2. Use panel hashes only for viewport ownership:
   `#import-media-inspection-run-panel`, `#import-execution-run-panel`, and
   `#import-apply-run-panel`.
3. Load historical detail only when the selected ID differs from the current run.
   The summary remains the cheap landing read; the detail endpoint is the
   selected-run read path.
4. Preserve selected run IDs across panel refreshes. A refresh must not clear
   historical detail while the URL still points at that run.
5. Show run IDs in recent-run tables. A historical run list without run IDs is
   not operator-clear and forces fragile tests to guess by position or time.
6. Keep authorization server-side. Client deep links are convenience state only;
   the admin/operator/read-only access rules remain enforced by the API and route
   guards.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Query params per runway panel | Shareable, reload-safe, easy to preserve across refresh | Multiple selected IDs can coexist in the URL when moving across panels |
| Hash-only selected state | Simple URL shape | Not enough structured state for reload/detail fetches |
| Always fetch selected detail | Consistent detail path | Wastes requests for current/latest run, increases load |
| Fetch detail only for non-current selection | Efficient and matches existing summary/detail split | Requires tests for current-vs-historical branching |
| Add visible run-ID column | Clear for operators and resilient for role/text tests | Adds one compact column to dense history tables |

## Final Stack

- Vue Router query state for selected run IDs.
- Vue Router hash state for panel navigation and scroll ownership.
- `useImportReviewAdminWorkflow` as the route-state coordinator.
- Shared `useImportCandidateRunSummary` for summary/detail loading.
- Production-shaped browser fixtures for summary, detail, start, and reconcile
  endpoints.
- Playwright browser verification through user-visible row IDs and buttons.

## Implementation Outcome

- Added workflow-level refresh handlers for media inspection, download execution,
  and import apply. Each handler reads the current route state and passes the
  selected run ID back into the summary loader.
- Wired runway panel `Refresh` actions through those handlers instead of raw
  summary loaders.
- Added a visible `Run` column to all three recent-run tables so historical rows
  are inspectable and selectable by ID.
- Added reusable browser fixture helpers for Import Review run summaries and the
  three run families.
- Added browser coverage for:
  - direct historical media-inspection, execution, and apply deep links;
  - selecting historical rows from recent history;
  - preserving selected historical detail after panel refresh.

## Security Notes

Selected run query parameters do not authorize access. They only request client
state. The API must continue to enforce role and run-detail access server-side.
The browser fixture preserves the production-shaped `404` path for unknown run
IDs, and earlier read-only Import Review browser coverage still proves requester
sessions cannot reach Import Review data.

## Validation

- `node --test test/client/useImportReviewAdminWorkflow.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-selected-run-deep-link-browser-verification.test.js`
- `npm run lint:client -- --quiet`
- `npm run lint:test -- --quiet`

## Next High-Value Item

Import Review run-detail failure diagnostics browser verification. Now that
historical run selection is stable and linkable, the next highest-risk surface is
the detail content inside failed historical runs: media warnings, transfer
observations, apply file-operation failures, and recovery guidance should remain
visible and role-safe when opened from a shared run URL.
