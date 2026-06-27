# Import Review Diagnostic Row Handoff Design

Status: Implemented

## Context

Media-inspection run detail now persists bounded per-file diagnostics in
`inspectionDiagnostics`. Those rows identify the affected import candidate and
file, but before this change they were informational only. Operators still had
to manually find the candidate before they could hold, reject, reopen, or inspect
planning context.

## Official Guidance Reviewed

As of June 2026:

- Playwright recommends user-facing locators such as roles and accessible names
  for resilient browser tests: <https://playwright.dev/docs/locators>
- Playwright best practices recommend testing visible user behavior instead of
  implementation details: <https://playwright.dev/docs/best-practices>
- Vue Router supports programmatic navigation with query and hash state through
  `router.replace`: <https://router.vuejs.org/guide/essentials/navigation.html>
- MDN documents native `<button>` semantics as the correct control for actions:
  <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button>
- OWASP authorization guidance favors deny-by-default, least-privilege access,
  and server-side authorization enforcement:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Use a native row action in the diagnostics table that emits the diagnostic
candidate ID upward to `ImportReviewView`. The view updates existing Import
Review route state to `candidate=<id>` and `#import-review-selection-stage`
through the admin workflow route replacer, preserving the current
`mediaInspectionRunId`.

Do not create a second diagnostic-detail page or a client-only global selection
store. The candidate detail panel is already the authorized action surface, and
the route is the durable browser/share state.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Native row button + existing route state | Keyboard-accessible by default; preserves deep links; low surface area; browser-testable through visible behavior | Lands at candidate level, not the exact file row yet |
| `<RouterLink>` per row | Simple markup and URL preview | Harder to preserve merged run/filter state without duplicating route-state logic |
| Global event/store handoff | Avoids URL churn | Non-shareable state; easier to desynchronize selected run and selected candidate |
| New diagnostic detail view | Could be specialized for diagnostics | Larger route, authorization, and data-model surface for one handoff |

## Final Stack

- **UI control:** Native `<button type="button">` in
  `ImportCandidateMediaInspectionDiagnostics.vue`.
- **Component boundary:** `open-candidate` event emitted from diagnostics to
  `ImportCandidateMediaInspectionPanel.vue`, then to `ImportReviewView.vue`.
- **Route state:** Existing `useImportReviewAdminWorkflow().replaceImportReviewRouteState`
  with `candidateId` and `#import-review-selection-stage`.
- **Focus behavior:** The selection workspace is focusable with `tabindex="-1"`;
  handoff scrolls and focuses it after route replacement.
- **Security:** No new API surface. The server remains the authority for
  candidate detail and review actions. Requester/non-admin restrictions remain
  enforced by existing route and endpoint authorization.
- **Verification:** Browser test starts from a selected media-inspection run URL,
  opens a diagnostic candidate, and verifies the candidate query, preserved
  `mediaInspectionRunId`, focused selection workspace, selected historical run,
  and actionable candidate detail.

## Outcome

- Diagnostic rows now expose `Open candidate` actions with per-file accessible
  names, such as `Open candidate for alpha.flac`.
- The handoff preserves selected-run context by keeping
  `mediaInspectionRunId=<run>` in the route.
- The route-state normalizer now accepts internal `candidateId` state keys in
  addition to the public `candidate` query key, preventing future route merge
  mistakes across composables.
- Added
  `test/browser/import-review-diagnostic-row-handoff-browser-verification.test.js`
  for the end-to-end operator flow.

## Follow-Up

The next high-value enhancement is file-level diagnostic focus: carry the
diagnostic `fileId` into route/hash or local focus state so the candidate detail
panel can scroll to and emphasize the exact affected file after the candidate
handoff.
