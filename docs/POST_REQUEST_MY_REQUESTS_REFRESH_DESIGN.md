# Post-request My Requests Refresh Design

Status: Implemented on 2026-06-25.

## Scope

Verify the requester-visible handoff after a release request is submitted from
Search: the request mutation must be observable in My Requests without a manual
fixture reset, page recovery step, or admin-only read.

This slice intentionally verifies the browser contract around the existing
production data path:

- `POST /api/v1/library/media-requests` records the request mutation.
- `GET /api/v1/library/media-requests?scope=mine` powers My Requests.
- `GET /api/v1/library/media-request-summary?scope=mine` powers the My Requests
  notification read.
- `MyRequestsView` renders request cards from the scoped read model.

## Official Guidance Reviewed

- W3C WCAG 2.2 Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WCAG 2.2 Error Identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- W3C ARIA19 live-region technique:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

1. Keep My Requests reads scoped through `scope=mine`.
   The browser fixture should model the server read contract instead of adding a
   client-only refresh shortcut. This keeps ownership and authorization
   semantics server-owned.

2. Verify post-submit visibility through the user journey.
   A requester logs in, submits a release request, navigates to My Requests, and
   sees the submitted request card with the expected title, request kind, and
   status.

3. Use role-first Playwright locators and retrying assertions.
   The test should find the request card by accessible name and status text
   rather than implementation-only selectors.

4. Keep fixture plumbing modular.
   The metadata fixture now adapts recorded request mutations into the My
   Requests read model, including matched release IDs, target attribution, and
   fulfillment summary. No production-only test branches were added.

## Pros and Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Extend metadata browser fixture read endpoints | Exercises one end-to-end browser flow from request mutation to My Requests | Adds more responsibility to the metadata fixture |
| Install the static media-request fixture after submit | Reuses existing fixture | Breaks continuity because the submitted mutation is not the source of the read row |
| Add production client refresh hooks after submit | Could make navigation feel immediate in a mounted view | Not needed for this route-to-route contract and risks mixing test concerns into app code |

## Final Stack

- Browser verification: Node test runner plus Playwright Chromium runtime.
- Fixture strategy: metadata browser fixture owns the request mutation record and
  My Requests scoped read model for this cross-surface scenario.
- UI contract: existing `MyRequestsView`, `useMyRequests`, and `RequestCard`
  production code.
- Security posture: authenticated request path, CSRF-protected mutation path,
  scoped read path, and requester UI with no admin requester-for selector.

## Outcome

Added `test/browser/post-request-my-requests-refresh.test.js`.

The test creates a real requester through the admin API, completes forced
password change through the UI, verifies My Requests starts empty, submits
`Music Has the Right to Children` from Search, then navigates back to My
Requests and verifies the submitted request card appears with `Release` and
`Searching` state.

Updated `testing/browser/metadata-browser-fixtures.js` so recorded media-request
mutations are also available through:

- `GET /api/v1/library/media-requests?scope=mine`
- `GET /api/v1/library/media-request-summary?scope=mine`
- `GET /api/v1/library/media-requests/:id`
- request pipeline and event stubs for detail navigation continuity

## Next High-value Item

Submitted-request detail handoff browser verification: after the post-submit
request appears in My Requests, keyboard-activate that card and prove Request
Detail renders the submitted request read model, empty pipeline state, and
status journey without falling back to unrelated static fixtures.
