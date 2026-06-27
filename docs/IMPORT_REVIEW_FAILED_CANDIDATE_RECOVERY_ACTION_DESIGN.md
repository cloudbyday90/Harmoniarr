# Import Review Failed-Candidate Recovery Action States

## Status

Implemented in June 2026.

## Problem

The previous handoff slice proved that an operator can land in Import Review
with a failed candidate selected. The remaining gap was the recovery mutation
itself: `Reopen` needed browser proof for success and failure states, and the
workspace needed to avoid refreshing dependent state after a failed transition.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions: https://playwright.dev/docs/test-assertions
- Playwright actionability: https://playwright.dev/docs/actionability
- WCAG 2.2 focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 error identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- MDN ARIA alert role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
- MDN ARIA status role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Treat transition success and failure as first-class composable state | Gives components a single source of truth for feedback | Adds one more state ref to the queue workflow |
| Short-circuit workspace refreshes when a transition fails | Prevents misleading summary/preview churn after a rejected mutation | Requires wrappers to return transition results |
| Use `role="status"` for successful recovery and `role="alert"` for failures | Aligns with WCAG status/error guidance and supports role-first browser tests | Status focus must be deliberate because the triggering button can disappear |
| Verify `Reopen` through direct Import Review browser coverage | Isolates the recovery mutation from the already-covered Request Detail handoff | Still needs database-backed route coverage for persistence edge cases |

## Final Recommendation Stack

- Keep review transitions owned by `useImportReviewQueue`.
- Add `actionStatus` alongside `actionError`, clearing both at transition start
  and selection changes.
- Make `useImportReviewWorkspace.runTransition()` return `null` on failure and
  skip route/summary/preview refreshes.
- Render transition success as a focusable polite status message and transition
  failure as an assertive alert in `ImportCandidateDetailPanel`.
- Extend browser fixtures with queued Import Review transition failures.
- Add browser coverage for:
  - successful failed-candidate `Reopen` to `Pending`,
  - refreshed pending queue count and action buttons,
  - focus moving to the success status after the `Reopen` button disappears,
  - failed `Reopen` leaving the candidate failed and retryable,
  - and no success status on failure.

## Implementation Outcome

- `useImportReviewQueue` now exposes `actionStatus` and sets action-specific
  success copy for select, hold, reject, and reopen transitions.
- `useImportReviewWorkspace` now short-circuits failed transition results.
- `ImportCandidateDetailPanel` now:
  - renders successful action feedback with `role="status"`,
  - moves focus to that status after success,
  - renders transition errors with `role="alert"`,
  - and keeps a visible focus outline on the focused status message.
- `metadata-browser-fixtures.js` now supports
  `queueMetadataImportReviewTransitionFailure`.
- Added shared failed-candidate browser seed builders in
  `testing/browser/import-review-browser-helpers.js`.
- Added
  `test/browser/import-review-failed-candidate-recovery-action-browser-verification.test.js`.

## Security Notes

The UI work does not broaden access. Candidate management remains guarded by the
existing admin/operator Import Review controls and server-side transition
routes. Browser fixtures simulate both successful and rejected transition
responses through the production client API path, and the failure case verifies
the failed candidate remains retryable without showing a false success state.

## Next High-Value Item

Verify Import Review review-state transitions for selected/held/rejected
candidates as a small transition matrix. `Reopen` is now covered for failed
imports; the adjacent risk is drift in the other candidate-management actions,
especially reject confirmation, focus return, and queued summary refreshes.
