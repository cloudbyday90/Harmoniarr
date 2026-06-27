# Request Action Browser Verification Design

## Context

This slice verifies the primary request mutation after the card-grid and Release
Detail keyboard work. It covers two high-value browser paths:

- Release-card request action from Search, including the confirmation dialog.
- Release Detail direct request action, including admin requester-for selection.

The work stays client-side and fixture-scoped. It does not replace server route
tests for media-request authorization, CSRF, duplicate linking, or persistence.

## Official Sources Reviewed

Reviewed on 2026-06-25 for current guidance requested as of June 2026:

- W3C WAI-ARIA APG modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- W3C WAI-ARIA APG modal dialog example:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/
- W3C WCAG 2.2 focus not obscured:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- W3C WCAG 2.2 focus appearance:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- W3C WCAG 2.2 recommendation:
  https://www.w3.org/TR/WCAG22/
- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- Playwright input:
  https://playwright.dev/docs/input
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Recommendations

### Dialog Focus Contract

**Recommendation.** Confirmation and detail request flows should capture the
opener, move initial focus inside the dialog, keep Tab traversal inside the
active native dialog, and restore focus on Escape, Close, and successful request.

| Pros | Cons |
| --- | --- |
| Matches APG modal dialog expectations for focus placement and return | Adds lifecycle bookkeeping to small modal components |
| Prevents keyboard users from losing position after a successful mutation | Parent-driven close paths must not bypass modal cleanup |
| Makes browser tests stable because focus outcomes are explicit | Requires a focused browser test, not just component snapshots |

### Role-Based Requester-For Coverage

**Recommendation.** Browser fixtures should seed at least two eligible users for
admin sessions and assert the submitted `requestedForUserId` payload for both
card-confirm and detail-direct flows.

| Pros | Cons |
| --- | --- |
| Proves the admin-only requester-for affordance is wired to the mutation | Fixture must model a minimal `/api/v1/users` response |
| Catches regressions where select values are displayed but not submitted | Does not prove server-side admin authorization by itself |

### Mutation Fixture Boundary

**Recommendation.** Keep browser mutation fixtures narrow: intercept
`POST /api/v1/library/media-requests`, validate the minimum payload, persist the
recorded request in `sessionStorage`, and return the same `ok/mediaRequest/linked`
shape consumed by `useReleaseRequest`.

| Pros | Cons |
| --- | --- |
| Verifies the real client API path and CSRF-enabled request wrapper | Does not exercise the real database media-request store |
| Enables exact payload assertions without a brittle database setup | Duplicate and lifecycle states are only minimally modeled |
| Keeps the browser suite deterministic and fast | Server route tests remain required for security enforcement |

### Secure Request Posture

**Recommendation.** Continue using the existing `createMediaRequest` wrapper with
`includeCsrf: true`, and validate security at the server test layer. Browser
coverage should prove the UI calls the protected route with the expected payload,
not duplicate CSRF internals.

| Pros | Cons |
| --- | --- |
| Keeps security concerns at the shared API boundary | Browser fixture cannot prove real CSRF rejection behavior |
| Aligns with OWASP guidance to protect state-changing requests | Requires route tests to remain in the validation stack |

## Final Recommendation Stack

1. Harden modal request focus behavior in the components that own dialogs.
2. Add a reusable metadata browser fixture read helper for recorded request
   payloads.
3. Add stateful browser fixture coverage for `/api/v1/users` and
   `/api/v1/library/media-requests`.
4. Add a focused browser suite that verifies:
   - keyboard reachability from an active release card to its Request button,
   - confirmation-dialog focus placement and containment,
   - admin requester-for selection payload,
   - requested disabled-state feedback after success,
   - Release Detail direct request payload,
   - Release Detail focus restoration after successful request.
5. Keep server authorization, CSRF rejection, and durable duplicate-linking
   behavior covered by backend route/service tests.

## Outcome

Implemented:

- `ConfirmRequestModal` now mirrors the modal focus contract used by Release
  Detail: capture opener, initial focus on Close, restore focus on close, and a
  visible focus ring for the requester-for select.
- `ReleaseDetailModal` now restores opener focus before emitting a successful
  `requested` close event.
- `metadata-browser-fixtures` now provides deterministic eligible users,
  records media-request payloads, and exposes
  `readMetadataBrowserFixtureState(page)` for exact browser assertions.
- `request-action-browser-verification.test.js` verifies the Search release-card
  confirmation path and the Release Detail direct request path.

## Next High-Value Item

Request failure and retry-state browser verification is the next logical item.
The success paths are now covered; the remaining high-risk request behavior is
error handling: server validation failure, network failure, retry after failure,
and preserving dialog state without marking a release as requested.
