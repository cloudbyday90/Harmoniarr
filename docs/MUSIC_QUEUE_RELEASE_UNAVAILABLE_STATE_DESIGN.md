# Music Queue Release-Unavailable State Design

Status: **Implemented.**

Date: 2026-07-31.

## 1. Purpose

Library-add diagnostics uses a release-scoped, reloadable URL. A missing,
malformed, or non-owned release intentionally receives the same generic 404.
The previous client view preserved that security behavior but combined a raw
error with an empty-state card that implied no library-add history existed.

This slice makes the unavailable state explicit without turning a URL into an
access grant or revealing whether the release ever existed for another user.

## 2. Official Sources Reviewed

The following official guidance was reviewed on 2026-07-31 for the requested
June 2026 baseline.

| Source | Design input |
| --- | --- |
| [OWASP API Security: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) | Keep the generic owner-scoped 404. The client must not transform an unavailable identifier into object-existence information. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Describe the unavailable state in text and provide the known recovery action. |
| [W3C WAI-ARIA: status messages](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103.html) | Expose asynchronous result changes with a semantic live-region role rather than visual copy alone. |
| [Playwright Locators](https://playwright.dev/docs/locators) | Verify the rendered recovery state through its accessible role and action, not brittle implementation selectors. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the generic empty state and raw API error | No additional UI logic. | Gives contradictory guidance, exposes implementation wording, and encourages meaningless refreshes. | Reject. |
| Redirect directly to Music Queue after a 404 | Minimal screen time. | Disorienting after a copied or stale deep link; the user receives no explanation. | Reject. |
| Render a dedicated generic unavailable state with one return action | Preserves security, explains the outcome, avoids duplicate content, and gives a clear recovery path. | Requires the client to retain structured error metadata. | Adopt. |

## 4. Final Recommendation Stack

- Keep the server response as `404 music_queue_release_not_found` for missing,
  malformed, and cross-operator wanted-release IDs.
- Extend the shared asynchronous read composable to retain the original error
  object alongside its display message. UI code branches on stable `status`
  and `code`, never error-message text.
- Reuse `MusicQueueReleaseUnavailable` for the scoped diagnostic route when
  that exact 404 contract occurs. Its generic `role="status"`,
  `aria-live="polite"` state and `Open Music Queue` action now match direct
  Music Queue release links.
- Hide the ordinary scoped summary, history, refresh button, and raw error
  notice in that state. Offer one primary return action to the Music Queue
  overview, not the unavailable release URL.
- Leave unexpected failures on the existing generic error path so they are not
  misrepresented as authorization or removal outcomes.

## 5. Security And Accessibility Properties

- Copy avoids confirming whether a release was deleted, belongs to another
  administrator, or was never valid.
- The unavailable state does not serialize or display diagnostics, source
  paths, usernames, candidate identifiers, or the raw server message.
- A polite status announcement informs assistive technology users when the
  asynchronous route read completes without interrupting their current task.
- The only recovery target is the Music Queue overview, which cannot repeat a
  stale or unauthorized release lookup.

## 6. Validation

- Shared async-resource tests assert structured API errors are exposed, cleared
  on success, and cleared by reset.
- Activity Imports contracts assert the scoped unavailable branch and its
  Music Queue overview handoff are present.
- Browser acceptance runs two isolated administrator sessions against real
  PostgreSQL. Each copied release URL must receive a 404, render the shared
  dedicated status state, hide raw/empty diagnostic content, and expose only
  the safe `Open Music Queue` recovery link.
- Client lint and production build validate the Vue template and scoped CSS.

## 7. Outcome

The secure release-unavailable state is implemented. A copied or stale scoped
diagnostic URL now reuses the direct Music Queue recovery presentation, with
one clear `Open Music Queue` next step instead of an ambiguous mixture of
empty history and a raw failure message.
