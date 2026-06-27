# Import Review Requester/Non-Admin Read-Only Access Verification

## Status

Implemented in June 2026.

## Problem

The Import Review transition matrix proves admin review actions, but the
security counterpart was unverified: requester sessions must not reach Import
Review, and non-admin sessions that can reach the Activity workspace must not
receive candidate-management controls or trigger transition endpoints.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright actionability/assertions: https://playwright.dev/docs/actionability
- WCAG 2.2 focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- MDN ARIA status role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- MDN ARIA alert role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep requester access blocked at the router for Import Review | Prevents the view and its candidate APIs from loading for requester sessions | Does not replace server-side authorization checks |
| Verify non-admin operator access as read-only | Proves the actual non-admin Import Review branch rather than only the requester redirect | Requires creating a second role in browser setup |
| Assert absence of management controls and transition network calls | Catches both UI regressions and accidental mutation attempts | Network assertions need stable route/path matching |
| Reuse production-shaped browser fixtures and auth flows | Exercises route guards, session role state, and client API paths together | Browser tests are slower than pure unit tests |
| Keep status/error accessibility conventions from the admin transition work | Maintains consistent screen-reader behavior for future read-only error states | This slice does not add new status UI |

## Final Recommendation Stack

- Treat requester sessions as route-restricted for `/app/activity/candidates`.
- Treat operator/non-admin Import Review as read-only:
  - candidate queue and detail can render,
  - filters and review notes are hidden,
  - `Select`, `Hold`, `Reject`, and `Reopen` are absent,
  - operator runway panels are absent,
  - transition endpoints are not called.
- Keep server-side transition routes as the durable authorization boundary.
- Use role-first Playwright locators and request capture against
  `/api/v1/import-candidates/:id/:transition` to prove no mutation path fires.

## Implementation Outcome

- Added generic browser user helpers:
  - `createUserThroughApi(page, { role })`
  - `loginUserThroughUi(page, ...)`
- Existing requester helpers now wrap the generic helpers without changing their
  public contract.
- Added
  `test/browser/import-review-read-only-access-browser-verification.test.js`
  with two scenarios:
  - requester deep-link redirect to Home before any Import Review API request,
  - operator read-only candidate inspection with no management buttons and no
    transition requests.

## Security Notes

This slice deliberately verifies least-privilege behavior at two layers of the
client experience: route denial for requester sessions and read-only rendering
for operator/non-admin sessions. It does not relax server permissions. The
browser proof complements existing server/integration authorization tests by
ensuring the UI does not expose or invoke mutation affordances outside admin
sessions.

## Next High-Value Item

Verify Import Review operator runway start/reconcile controls. The access
boundary is now covered; the next adjacent operational risk is the admin-only
runway that starts media inspection, download execution, reconciliation, and
apply runs.
