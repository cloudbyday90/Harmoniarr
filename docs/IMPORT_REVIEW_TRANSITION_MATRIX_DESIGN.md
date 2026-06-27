# Import Review Review-State Transition Matrix

## Status

Implemented in June 2026.

## Problem

The failed-candidate recovery slice proved `Reopen` from `Failed`, but the
normal operator review states still had uneven browser proof. The largest gap
was not just button visibility; it was the state handoff after a candidate moves
outside the active pending filter. `Hold` and `Reject` can remove a candidate
from the visible queue while the operator still needs the detail panel to show
the result, next legal actions, and feedback.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions/actionability: https://playwright.dev/docs/actionability
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 error identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- MDN ARIA alert role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
- MDN ARIA status role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Preserve the transitioned candidate detail after every successful review action | Keeps feedback, next actions, and route state tied to the action the operator just took | The selected detail can temporarily reference a candidate not present in the filtered queue list |
| Keep queue and summary refreshes after successful transitions | Ensures queue counts and readiness panels reflect durable state | Requires browser fixtures to model state changes across multiple endpoints |
| Test the matrix through direct Import Review browser flows | Covers real keyboard, dialog, live-region, and route behavior | Slower than pure composable tests |
| Use reject confirmation as part of the matrix, not a separate unit-only check | Proves the destructive action gate and disabled-confirm state in the actual dialog | Needs more careful role/name assertions |
| Keep management controls operator/admin-only and rely on server-side transition routes for enforcement | Aligns with OWASP least-privilege guidance | Browser tests prove UI affordances, not full authorization persistence |

## Final Recommendation Stack

- Keep transition orchestration in `useImportReviewQueue`.
- After a successful transition, reload the queue, then reload the transitioned
  candidate detail by id even if the active filter excludes it.
- Preserve `actionStatus` success feedback and `actionError` failure feedback as
  the single UI contract for transition results.
- Keep route replacement idempotent: update the route only when the selected
  candidate or filters actually change.
- Use shared browser fixture builders for import-review candidates so pending,
  held, selected, rejected, and failed candidates all share one payload shape.
- Verify the matrix with role-first Playwright browser tests:
  - `Pending -> Held -> Selected`,
  - `Selected -> Rejected -> Pending`,
  - reject confirmation disabled until acknowledged,
  - success status focus and visible focus ring,
  - queue counts and selected-summary refreshes,
  - persisted fixture state after each scenario.

## Implementation Outcome

- `useImportReviewQueue.transitionSelectedCandidate()` now preserves the
  transitioned candidate detail instead of falling through to the first filtered
  queue row when the candidate leaves the active filter.
- `useImportReviewWorkspace` behavior now keeps route/detail context stable when
  a transition does not require a route change.
- `testing/browser/import-review-browser-helpers.js` now exposes generic
  `buildImportReviewCandidate()`, `buildImportReviewPreview()`, and
  `seedImportReviewCandidateWorkspace()` helpers while retaining failed-candidate
  wrappers.
- Added
  `test/browser/import-review-transition-matrix-browser-verification.test.js`.
- Updated client unit tests for the preserved-detail transition contract.

## Security Notes

This slice does not expand candidate-management access. The UI still hides
candidate actions for non-managing sessions, and the production transition
routes remain the authorization boundary. The browser matrix deliberately uses
the same client API paths as production so button states, dialog behavior, and
state refreshes cannot drift into a test-only path.

## Next High-Value Item

Verify requester/non-admin Import Review access behavior for candidate detail
and management controls. The transition matrix now proves the operator happy
paths; the adjacent security value is a browser contract that requester-facing
Import Review views remain read-only, do not expose management buttons, and do
not call transition endpoints.
