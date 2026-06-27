# Request Detail Cancellation Failure Browser Verification

## Status

Implemented, June 2026.

## Problem

Requester cancellation success was covered in
`REQUEST_DETAIL_CANCELLATION_BROWSER_VERIFICATION_DESIGN.md`, but destructive
mutations also need browser proof for failure and stale-state paths. A
requester can see `Cancel request` on a `needs_fetch` detail page while the
cancel endpoint fails transiently or returns `409 Conflict` because the request
became terminal elsewhere. The UI must not show a false cancelled state after a
transient failure, and it must not leave stale cancellation controls visible
after a conflict.

## Official-source guidance reviewed

- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- Playwright auto-waiting/actionability:
  https://playwright.dev/docs/actionability
- WAI-ARIA alert dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
- WAI-ARIA modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WCAG status messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG error identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

Keep cancellation as a state-changing POST behind the existing CSRF-backed API
helper. The browser tests should not bypass this path or mutate Vue state
directly; the fixture should emulate the route response shape and leave backend
ownership/authorization semantics to server route tests.

Treat transient failures and conflicts differently. For a `5xx` or network-like
failure, show assertive error feedback and keep the request in its previous
cancellable state so the user can retry. For `409 Conflict`, show the error
message and immediately refresh the detail read model because the durable state
may already have changed.

Use role-first browser assertions. The tests drive the shared `alertdialog`,
assert `role="alert"` feedback for failures, and assert the durable detail and
My Requests read paths after conflicts.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Browser fixture failures plus `409` detail revalidation (chosen) | Covers the real requester UI path, dialog, toast, API error normalization, and refreshed read model | Adds cancellation-specific fixture hooks |
| Component-only test around `handleCancel` | Faster | Misses dialog focus, toast roles, browser state, and My Requests refresh |
| Always reload after any cancel failure | Simple | Unnecessary extra reads after transient failures and can hide retry-state bugs |

## Final recommendation stack

Playwright browser coverage with role-first locators, cancellation-specific
fixture failure queues, explicit stale-state fixture mutation, `RequestDetail`
`409` revalidation, and existing `ToastStack` alert/status feedback.

Security stays server-owned: the production route remains authenticated,
CSRF-protected, and owner-or-admin authorized. The browser tests prove the UI
uses that protected route and handles secure failure responses without exposing
admin-only controls or stale terminal state.

## Implementation outcome

- Added
  `test/browser/request-detail-cancellation-failure-browser-verification.test.js`.
- Extended `testing/browser/metadata-browser-fixtures.js` with:
  - `queueMetadataMediaRequestCancellationFailure`
  - `markMetadataMediaRequestCancelled`
  - persisted `mediaRequestCancellationFailures`
- Updated `RequestDetailView.vue` to refresh the detail read model after a
  cancellation `409 Conflict`.

The suite verifies:

- A transient `503` cancellation failure shows assertive error feedback, leaves
  the request in `needs_fetch`, keeps `Cancel request` available, and succeeds
  on retry.
- A stale `409 Conflict` shows error feedback, refreshes to `cancelled`, removes
  `Cancel request`, and shows `Cancelled` in My Requests.

## Next high-value item

Requester Request Detail event timeline browser verification. Cancellation now
has success, transient failure, and conflict coverage; the next adjacent gap is
whether durable request events remain understandable and role-safe when a
request transitions through cancellation, reassignment, and fulfillment states.
