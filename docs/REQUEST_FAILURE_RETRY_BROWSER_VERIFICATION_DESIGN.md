# Request Failure and Retry Browser Verification Design

## Context

Batch AF proved successful request submission from release cards and Release
Detail. This slice verifies the failure side of the same mutation workflow:
failed submissions must not mark a release as requested, dialogs must remain
open and retryable, error feedback must be exposed accessibly, and linked
duplicate responses should still transition to requested feedback.

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
- W3C ARIA19 error/live-region technique:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright assertions:
  https://playwright.dev/docs/test-assertions
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Recommendations

### Keep Failed Mutations Retryable

**Recommendation.** A failed request should leave the active dialog open,
preserve the requester-for selection, show a text error, and return focus to the
retry button after the pending state clears.

| Pros | Cons |
| --- | --- |
| Prevents users from losing context after transient failures | Requires explicit focus recovery because disabled buttons can lose focus |
| Makes retry discoverable without restarting the browsing flow | Adds a small amount of modal lifecycle code |
| Aligns with WCAG error identification and APG dialog focus guidance | Needs browser coverage; unit tests cannot prove focus outcomes |

### Model Failures Explicitly in Browser Fixtures

**Recommendation.** Add opt-in queued failure responses to the metadata browser
fixture. Each queued failure is scoped by request key or release title and is
consumed once.

| Pros | Cons |
| --- | --- |
| Keeps success-path fixtures deterministic by default | Fixture state must sync from `sessionStorage` before each POST |
| Supports retry verification without a real database mutation | Does not replace backend route/service failure tests |
| Allows server-style JSON errors and network-style throws when needed | More fixture controls require clear helper names |

### Verify Linked Duplicate Responses

**Recommendation.** Browser tests should also prove that an existing server-side
request link response still resolves to the requested UI state. This is distinct
from client-side duplicate prevention.

| Pros | Cons |
| --- | --- |
| Covers the real multi-user duplicate/link outcome | Only proves the client consumes the `linked` shape |
| Protects against false error treatment for successful linked responses | Server duplicate uniqueness still belongs in backend tests |

### Preserve Security Boundaries

**Recommendation.** Keep CSRF and authorization enforcement in the existing
server/API validation stack. Browser fixture coverage should prove the UI
submits through `createMediaRequest` and does not fake success on failed
responses.

| Pros | Cons |
| --- | --- |
| Maintains one shared CSRF request boundary | Browser fixtures cannot prove CSRF rejection |
| Avoids leaking server internals into UI tests | Requires backend route tests to remain part of release validation |

## Final Recommendation Stack

1. Extend the metadata browser fixture with:
   - `queueMetadataMediaRequestFailure(page, failure)`,
   - `markMetadataReleaseRequestLinked(page, requestKey)`,
   - POST-time fixture-state sync from `sessionStorage`.
2. Extract reusable request browser navigation helpers for Search release cards
   and Artist Detail Release Detail opening.
3. Add browser coverage that verifies:
   - confirmation-dialog server failure keeps the dialog open,
   - `role="alert"` exposes the error text,
   - requester-for selection survives failure,
   - failed requests do not record media requests,
   - retry records the request and transitions to requested feedback,
   - linked duplicate responses transition to requested feedback,
   - Release Detail failure remains retryable and preserves focus/context,
   - successful Release Detail retry restores focus to the opener.
4. Harden request dialogs so failed submissions return focus to their retry
   button after disabled/loading state clears.

## Outcome

Implemented:

- `ConfirmRequestModal` focuses its Confirm request button after a failed
  submission so retry remains keyboard-local.
- `ReleaseDetailModal` focuses its Request button after a failed direct request.
- `metadata-browser-fixtures` now supports queued media-request failures and
  pre-marked linked request keys.
- `request-action-browser-helpers.js` shares Search and Release Detail browser
  setup between request suites.
- `request-failure-retry-browser-verification.test.js` covers failure, retry,
  and linked duplicate response behavior.

## Next High-Value Item

Requester-role request browser verification is the next logical item. The
current request browser suites run as admin to exercise requester-for controls;
the remaining role-specific risk is requester sessions, where the requester-for
selector must be absent and request payloads must target the authenticated
requester implicitly.
