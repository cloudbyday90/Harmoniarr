# Request Detail Cancellation Browser Verification

## Status

Implemented, June 2026.

## Problem

Batch AJ proved that a requester can submit a release request and open its
Request Detail page. The next high-risk requester action on that page is
`Cancel request`: it opens a destructive confirmation dialog, posts to the
CSRF-protected cancellation endpoint, reloads durable request state, and should
remove further cancellation controls once the request is terminal.

## Official-source guidance reviewed

- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- Playwright auto-waiting/actionability:
  https://playwright.dev/docs/actionability
- WAI-ARIA modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WAI-ARIA alert dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
- WCAG status messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG error identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

Use a browser test that drives accessible roles instead of CSS selectors:
the request card opens the existing detail route, the detail `Cancel request`
button opens the shared `alertdialog`, and the dialog-scoped confirm button
submits the mutation. This aligns the test with how keyboard and assistive
technology users reach the control.

Keep the fixture aligned to the production HTTP contract rather than mocking
component internals. The fixture now handles
`POST /api/v1/library/media-requests/:id/cancel`, rejects non-cancellable
states with `409`, persists `requestState: "cancelled"`, and returns the same
read-model shape the detail view already consumes.

Verify durable UI state after the toast. The toast proves status-message
feedback, but the acceptance criteria are the reloaded Request Detail journey,
absence of further destructive/admin controls, and My Requests showing
`Cancelled`.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Browser route-level verification with fixture cancellation support (chosen) | Covers real requester navigation, confirmation, API call, reload, toast, and list refresh | Requires fixture mutation support |
| Unit-test `handleCancel` in isolation | Fast and narrow | Misses routing, confirmation, toast live region, and detail/list read-path refresh |
| Database-backed end-to-end cancellation test | Highest backend fidelity | Slower; duplicates existing server cancellation ownership/state tests for this UI contract |

## Final recommendation stack

Playwright browser scenario with role-first locators, the existing shared
`ConfirmDialog`/`ToastStack`, production `cancelMediaRequest` API wiring, and
metadata fixture persistence for cancellation read models.

The backend remains responsible for the security boundary: authenticated route,
CSRF requirement, and owner-or-admin authorization. The browser test verifies
that the requester UI uses that route and never exposes admin-only reassignment
or import-review controls after cancellation.

## Implementation outcome

- Added `test/browser/request-detail-cancellation-browser-verification.test.js`.
- Extended `testing/browser/metadata-browser-fixtures.js` with persisted cancel
  mutation support and cancelled fulfillment read models.
- Hardened `ConfirmDialog.vue` by binding its function ref with `:ref`, ensuring
  the shared native `<dialog>` calls `showModal()` when opened through
  `useConfirm`.
- Verified the requester path:
  Search -> request release -> open Request Detail -> confirm cancellation ->
  see `Request cancelled.` status feedback -> see cancelled journey state ->
  return to My Requests and see the cancelled card.

## Next high-value item

Request Detail cancellation failure and conflict-state browser verification.
The success path now has coverage; the adjacent risk is a failed or stale
cancellation attempt where the dialog closes, the toast/error copy must be
clear, and the detail page must remain recoverable without presenting a false
terminal state.
