# Requester-Role Request Browser Verification Design

## Context

Batches AF and AG verified request success, failure, retry, and linked-response
behavior as an admin so requester-for controls could be exercised. This slice
verifies the restricted requester role:

- requester sessions must not see admin requester-for controls,
- requester request payloads must omit `requestedForUserId`,
- requester sessions should not trigger the admin user-list endpoint,
- operator policy controls must not appear in Artist Detail for requesters.

Server-side authorization and CSRF enforcement remain backend route/service
responsibilities. This browser slice verifies the client role surface and
payload shape.

## Official Sources Reviewed

Reviewed on 2026-06-25 for current guidance requested as of June 2026:

- W3C WAI-ARIA APG modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- W3C WCAG 2.2 Error Identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- W3C WCAG 2.2 Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
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

### Requester Surface Least Privilege

**Recommendation.** Requester sessions should render only requester-owned request
controls. Admin requester-for selectors and operator policy controls should be
absent, not disabled.

| Pros | Cons |
| --- | --- |
| Reduces accidental disclosure of admin/operator affordances | Requires role-aware UI assertions in browser coverage |
| Matches least-privilege guidance and the existing route guard model | Client-side hiding is not authorization by itself |
| Keeps requester workflows simpler and less error-prone | Backend tests must continue enforcing real permissions |

### Avoid Admin User-List Reads for Requesters

**Recommendation.** User-list reads for requester-for controls should only run
for admin sessions. Requester request flows should rely on authenticated session
identity and submit no explicit `requestedForUserId`.

| Pros | Cons |
| --- | --- |
| Avoids unnecessary calls to an admin-only API | Adds an explicit disabled mode to the active-users composable |
| Prevents cached admin user lists from leaking into requester UI state | Requires care with module-level caches during role changes |
| Keeps request payloads narrower for restricted users | Still needs backend authorization for malicious payloads |

### Browser Fixture Evidence

**Recommendation.** Extend request browser fixtures with a user-list fetch count
so tests can prove requester flows do not call `/api/v1/users`.

| Pros | Cons |
| --- | --- |
| Provides direct evidence for the no-overfetch contract | Browser fixture state grows slightly |
| Catches accidental unconditional `useActiveUsers` calls | Does not prove the real server denies the route |

## Final Recommendation Stack

1. Add an `enabled` option to `useActiveUsers` that skips fetching and ignores
   cached users when disabled.
2. Use the disabled active-users mode in `ReleaseDetailModal` unless the session
   role is admin.
3. Gate Artist Detail operator policy editing to non-requester roles.
4. Extend metadata browser fixture state with `userListFetchCount`.
5. Add a requester browser suite that:
   - creates a real requester through the admin API,
   - logs in through the forced password-change path,
   - verifies Search release-card request confirmation has no requester-for
     selector,
   - verifies card request payload omits `requestedForUserId`,
   - verifies Artist Detail exposes no operator policy selection controls,
   - verifies Release Detail has no requester-for selector,
   - verifies Release Detail request payload omits `requestedForUserId`,
   - verifies no `/api/v1/users` reads occurred.

## Outcome

Implemented:

- `useActiveUsers({ enabled: false })` now returns an empty non-loading state
  without fetching or reusing cached admin users.
- `ReleaseDetailModal` only fetches active users when the current session is
  admin.
- `ArtistDetailView` no longer exposes operator policy editing controls to
  requester sessions.
- `metadata-browser-fixtures` tracks `userListFetchCount`.
- `requester-role-request-browser-verification.test.js` verifies requester
  Search and Release Detail request flows against real requester login.

## Next High-Value Item

Post-request My Requests refresh verification is the next logical item. The
request mutation paths are now covered by role and outcome; the next user-visible
contract is whether a requester can immediately find the submitted request in
their My Requests surface without manual recovery steps.
