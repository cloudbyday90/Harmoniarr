# Import Review Diagnostic Repair Failure-State Verification Design

Status: Implemented

## Context

Diagnostic repair success is already covered: an operator can open a media
inspection diagnostic, land on the affected candidate file, execute `Reopen`,
and keep the selected-run and file route state. The remaining risk was the
negative path. If `Reopen` fails from that same diagnostic context, the UI must
not clear the selected diagnostic file, lose the historical run, show a false
success state, or strand keyboard focus away from the retry action.

## Official Guidance Reviewed

As of June 2026:

- Playwright recommends user-facing role/text locators for resilient browser
  tests: <https://playwright.dev/docs/locators>
- Playwright best practices emphasize testing user-visible behavior and keeping
  tests isolated: <https://playwright.dev/docs/best-practices>
- Vue Router supports programmatic navigation with explicit `query` and `hash`
  state: <https://router.vuejs.org/guide/essentials/navigation.html>
- MDN documents `HTMLElement.focus()` for moving keyboard focus:
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus>
- MDN documents `Element.scrollIntoView()` for bringing the focused diagnostic
  row into view: <https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView>
- OWASP authorization guidance recommends server-side, deny-by-default
  authorization checks: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Keep the failure path on the existing Import Review transition contract. A
failed diagnostic repair should surface assertive `role="alert"` feedback,
return focus to the retryable `Reopen` action, preserve `candidate`,
`candidateFile`, and `mediaInspectionRunId`, and leave the candidate in its
pre-failure review state.

Do not add diagnostic-specific recovery state or a client-only success/failure
store. The server-authorized transition endpoint remains the source of truth;
the client only reflects the rejected mutation and leaves the operator in the
same diagnostic context.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Preserve diagnostic route state on failed repair | Keeps the operator at the exact file and run that caused the repair attempt; supports retry without re-navigation | Requires explicit browser coverage to prevent route replacement regressions |
| Clear route state after failed repair | Simple, but only superficially | Loses the diagnostic evidence exactly when the operator needs it most |
| Add diagnostic-specific repair state | Could tailor copy and controls | Duplicates the existing transition workflow and broadens authorization/API surface |
| Reuse the existing transition error path | Smallest secure surface; matches failed-candidate recovery behavior | Relies on the shared component focus/error contract staying stable |

## Final Stack

- **Fixture coverage:** the metadata browser fixture queues one-shot Import
  Review transition failures against the production-shaped
  `/api/v1/import-candidates/:id/reopen` path.
- **Browser verification:** `test/browser/import-review-diagnostic-repair-failure-state-browser-verification.test.js`
  opens a selected media-inspection run, handoffs to the affected file, queues a
  `409` repair failure, activates `Reopen`, and verifies alert feedback, retry
  focus, preserved route state, preserved file highlight, selected-run
  continuity, and no false success status.
- **Shared fixture builder:** `testing/browser/import-review-browser-helpers.js`
  now exposes reusable diagnostic candidate/run workspace builders for this
  failure test and later diagnostic repair retry coverage.
- **Security posture:** no new endpoint or client-side permission shortcut was
  added; the test exercises the existing admin-only transition path.

## Outcome

- Failed diagnostic repair attempts keep the affected file highlighted and keep
  `candidateFile` plus `mediaInspectionRunId` in the URL.
- The selected historical media-inspection run remains selected after the
  failed repair.
- The candidate remains `Selected`, `Reopen` remains available, and keyboard
  focus returns to `Reopen`.
- No `Candidate reopened for review.` success status appears after a rejected
  repair mutation.

## Follow-Up

The next high-value item is Import Review diagnostic repair retry-success
verification: after the queued failure path, retry the same diagnostic repair
successfully and prove the alert clears, status focus works, and diagnostic
route state remains intact through the recovery.
