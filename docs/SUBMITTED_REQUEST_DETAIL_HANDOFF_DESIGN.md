# Submitted-request Detail Handoff Design

Status: Implemented on 2026-06-25.

## Scope

Verify the second half of the requester tracking loop:

1. A requester submits a release request from Search.
2. The submitted request appears in My Requests.
3. Keyboard activation of that request card opens Request Detail.
4. Request Detail renders the same submitted request read model, not an
   unrelated static fixture.

This work builds on `docs/POST_REQUEST_MY_REQUESTS_REFRESH_DESIGN.md`.

## Official Guidance Reviewed

- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- W3C WCAG 2.2 Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WCAG 2.2 Page Titled:
  https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Recommendations

1. Verify the handoff through keyboard activation.
   The request card already exposes a `role="link"` activation path. The
   browser test should focus the submitted card and press Enter instead of
   navigating directly to the detail URL.

2. Assert visible detail landmarks and status copy.
   The test should prove the page title, request kind, journey section, request
   details, requester attribution, and pipeline state render from the submitted
   request.

3. Add an explicit empty pipeline state.
   Newly submitted requests often have no import candidates yet. Showing no
   pipeline section leaves the requester without an explanation. A small
   `Fulfillment pipeline` empty state makes the next system action clear.

4. Keep requester authorization constraints visible in the browser contract.
   The requester detail page must not expose admin reassignment or import-review
   links.

## Pros and Cons

| Decision | Pros | Cons |
| --- | --- | --- |
| Add a focused browser spec | Proves the full submitted-request list-to-detail journey | Adds another full-stack browser scenario |
| Add an empty pipeline card | Clarifies why no candidates are shown yet | Slightly more content on early request detail pages |
| Reuse the metadata fixture read model | Keeps the scenario continuous from request mutation to detail read | The fixture now covers more request read endpoints |

## Final Stack

- Browser verification: Node test runner plus Playwright Chromium runtime.
- Fixture strategy: metadata browser fixture owns the submitted request mutation
  and corresponding My Requests/detail read model.
- UI contract: existing My Requests card activation plus `RequestDetailView`.
- Security posture: authenticated requester session, CSRF-protected request
  mutation, scoped request reads, no requester access to admin-only actions.

## Outcome

Added `test/browser/submitted-request-detail-handoff.test.js`.

The suite creates and logs in a real requester, submits `Music Has the Right to
Children`, opens the submitted My Requests card by keyboard, and verifies Request
Detail renders:

- `Boards of Canada — Music Has the Right to Children`
- `Release request`
- `Request journey`
- active `Finding sources` copy
- request detail fields for artist, release, and requester attribution
- the empty `Fulfillment pipeline` state
- no `Reassign` button
- no `Open in import review` link

Updated `src/client/views/RequestDetailView.vue` with an explicit empty
pipeline state for requests that do not yet have import candidates or a linked
import candidate.

## Next High-value Item

Requester Request Detail cancellation browser verification: from this newly
submitted `needs_fetch` detail page, verify the requester can cancel the request
through the confirmation flow, receives visible completion feedback, and the
detail page/list read model transitions to a cancelled state without exposing
admin-only controls.
