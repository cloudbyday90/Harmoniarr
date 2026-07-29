# Import Review Completed Download Apply Handoff Design

Status: Implemented
Date: 2026-06-27

## Purpose

After a download transfer completes, Import Review can show durable execution
evidence and the candidate can move into `import_pending`. The remaining UX gap
was the handoff from "Downloader completed" to "this is now ready for import
apply." Operators could infer it from counts, but the apply runway did not
explicitly connect completed downloads to the next safe action.

This design adds an apply-readiness notice and browser verification for the
completed-download to import-apply path.

## Research Summary

- Vue recommends simple conditional rendering with derived state kept in
  reusable helper/computed logic rather than dense template expressions.
- Playwright recommends role and text locators for resilient browser tests, with
  auto-waiting/actionability checks for async UI and route updates.
- MDN documents the ARIA `status` role as a polite live region for status
  updates that should not interrupt the user's current workflow.
- OWASP object-property authorization guidance favors bounded task-specific
  fields. The notice uses only normalized candidate counts and run status; it
  does not expose provider payloads, API keys, or filesystem mutation internals.

Sources:

- Vue conditional rendering: https://vuejs.org/guide/essentials/conditional.html
- Vue computed properties: https://vuejs.org/guide/essentials/computed.html
- Playwright locators: https://playwright.dev/docs/locators
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- MDN ARIA `status` role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Rely on the existing import-pending counts

Pros:

- No new UI.
- Keeps the apply panel unchanged.

Cons:

- Operators must connect completed Downloader evidence to apply readiness
  themselves.
- The next action is easy to miss when the execution panel is expanded above the
  apply panel.

### Option B: Automatically scroll to the apply panel after reconciliation

Pros:

- Strong handoff after a manual sync.
- Makes the next action visible immediately.

Cons:

- Can be disruptive when operators are inspecting execution diagnostics.
- Does not help direct route reloads or historical completed-run views.

### Option C: Add an apply-readiness notice driven by import-pending state

Pros:

- Works after reload, manual refresh, or direct route entry.
- Keeps the destructive import apply confirmation gate unchanged.
- Uses the existing import-pending read model rather than adding a new endpoint.
- Can be tested through a pure helper plus a focused browser scenario.

Cons:

- Adds one more apply-panel status state.
- Still depends on the existing reconciliation path to move candidates into
  `import_pending`.

## Final Recommendation

Use Option C.

`buildImportApplyReadinessNotice` derives the notice from
`importPendingCandidateCount` and the apply run status. The apply panel renders a
polite status notice only when completed downloads are waiting and no apply run
is currently active.

## Security Notes

- No new backend route or mutation is added.
- The notice is derived from existing bounded counts and run status.
- The existing type-to-confirm gate for `Start import apply` is unchanged.
- Provider payloads, API keys, and filesystem mutation plans are not exposed.

## Implementation Outcome

- Added `buildImportApplyReadinessNotice` to the Import Review presentation
  helper.
- `ImportCandidateApplyPanel.vue` now explains when completed downloads are
  ready for import apply.
- Added client unit coverage for empty, active-run, single-ready, and retry
  states.
- Added browser coverage proving a completed transfer summary, import-pending
  candidate, enabled apply action, and queued apply run stay connected in the
  real Import Review route.

## Validation

Focused validation:

- `node --test test/client/import-candidate-presentation.test.js test/client/import-candidate-recovery-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-completed-download-apply-handoff-browser-verification.test.js`
- `npm run lint:client`
- `npm run lint:test`
