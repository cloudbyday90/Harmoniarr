# Import Review Operator Runway Controls Verification

## Status

Implemented in June 2026.

## Problem

Import Review already had browser proof for candidate review transitions and
least-privilege read-only access. The next admin-only mutation surface was the
operator runway: media inspection, download execution, manual transfer
reconciliation, and import apply controls. Those controls start or sync
background work, so stale enablement, missing feedback, or route drift can lead
operators to start unsafe or confusing work.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright actionability: https://playwright.dev/docs/actionability
- Playwright assertions: https://playwright.dev/docs/test-assertions
- WCAG 2.2 focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- MDN ARIA status role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- MDN ARIA alert role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Gate start controls on eligible candidate counts even when no current run exists | Prevents empty media inspection, download, or apply starts from the UI | Requires tightening existing helper expectations |
| Verify runway controls through browser flows, not only unit tests | Covers actionability, dialogs, route hashes, summaries, and persisted client state together | Slower than pure composable tests |
| Keep the browser fixture production-shaped for POST start/reconcile endpoints | Tests the real client API paths and read-after-write summary contract | Fixture must model enough run summary state to remain useful |
| Use `role="alert"` for runway action failures | Makes failed starts/reconciles announce and gives tests stable accessibility targets | Alert regions should be reserved for actionable errors |
| Keep worker execution out of this browser slice | Keeps the suite deterministic and focused on operator controls | Full media/apply worker behavior still needs integration/Docker evidence |

## Final Recommendation Stack

- Keep production start/reconcile calls in `src/client/lib/import-candidate-api.js`.
- Keep admin orchestration in `useImportReviewAdminWorkflow`.
- Harden shared start predicates in `import-candidate-presentation.js`:
  - selected candidates are required for media inspection and download execution,
  - import-pending candidates are required for import apply,
  - pending/running current runs still block a new start.
- Extend the metadata browser fixture with:
  - POST stubs for media inspection, execution, and apply run starts,
  - POST stub for execution reconciliation,
  - one-shot queued run failures,
  - durable run action logging and summary read-after-write state.
- Verify in Playwright with role-first locators:
  - empty queue disables all starts,
  - selected candidates enable media inspection and download starts,
  - execution reconciliation refreshes heartbeat summary,
  - import apply requires the destructive confirmation dialog,
  - failed execution start exposes `role="alert"` feedback and remains retryable.

## Implementation Outcome

- Tightened `canStartApplyRun`, `canStartExecutionRun`, and
  `canStartMediaInspectionRun` so zero eligible candidates always disables the
  start control.
- Added unit coverage for the corrected start predicates, including media
  inspection.
- Added run start/reconcile support to
  `testing/browser/metadata-browser-fixtures.js` for Import Review browser
  scenarios.
- Added `queueMetadataImportReviewRunFailure()` for deterministic start/sync
  failure coverage.
- Added `role="alert"` to runway panel summary-load, run-detail, and action
  errors.
- Hardened `useImportReviewAdminWorkflow` so post-mutation queue refreshes
  preserve the owning runway panel hash for media inspection, execution,
  reconciliation, and apply starts.
- Added
  `test/browser/import-review-operator-runway-controls-browser-verification.test.js`.

## Security Notes

This slice does not relax server authorization. Production routes still enforce
admin access, CSRF, and maintenance-lock behavior. The browser proof validates
the client side of least privilege and operator safety: controls are admin-only
from the previous slice, disabled until eligible state exists, and failed
mutations do not record successful run actions in fixture state.

## Next High-Value Item

Verify Import Review selected-run deep links and historical run detail loading.
The runway controls now start runs and move route hash state; the adjacent risk
is that `mediaInspectionRunId`, `executionRunId`, and `applyRunId` query state
must reload the intended run detail after navigation, refresh, or link sharing.
