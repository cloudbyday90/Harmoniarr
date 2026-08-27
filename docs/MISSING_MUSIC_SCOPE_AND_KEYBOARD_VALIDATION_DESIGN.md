# Missing Music scope and keyboard validation design

**Status:** Completed
**Date:** 2026-08-27
**Scope:** Legacy Music Queue and Acquisition compatibility routes; Missing Music release inspector

## Problem

Saved Music Queue and Acquisition links now lead to Missing Music. The route is
only a navigation convenience: it must never let a URL parameter grant access
to another user's release. At the same time, the non-modal release inspector
must give keyboard users a clear, visible focus path when it opens, when a
native download confirmation dialog closes, and when the user returns to the
worklist.

## Evidence and current boundary

The Missing Music decision service derives scope from the authenticated actor:
administrators may use the cross-user worklist; a requester is always limited
to their own user ID. Decision detail reads use the same server-side scoped
lookup and return one unavailable result for both unknown and unauthorized
release IDs. This prevents an identifier in a legacy URL from disclosing the
existence of another user's release.

The client must preserve ordinary legacy query and fragment state for
compatibility, but it must not treat a `requestedForUserId` query parameter as
authority. The service remains the authorization boundary for every read and
mutation.

## Options considered

| Option | Benefits | Costs |
| --- | --- | --- |
| Client-side role filtering only | Fast visual feedback | Unsafe: URLs and browser state are controllable; no protection for direct API access. |
| Reject all legacy query and fragment state | Smallest surface | Breaks saved links and loses useful non-authority navigation state. |
| Preserve navigation state, enforce scope in the service, and test both layers | Compatibility with a durable authorization boundary; clear auditability | Requires focused server and browser coverage. |

## Recommended stack

1. Keep the current server-side, default-deny scoped decision service as the
   sole authorization authority.
2. Keep legacy redirects as pure URL translators. They may preserve query and
   hash state but never select a user or authorize a decision.
3. Prove the boundary in tests: service tests for requester/admin scope and
   browser tests for canonical redirects and the unavailable state.
4. Use native semantic controls and the platform `<dialog>` element. Retain
   browser-owned opening, Escape dismissal, backdrop inertness, and focus
   return; add one small, reusable Tab-wrap helper because browser traversal
   did not cycle within this dialog in acceptance testing.
5. Give programmatically focused inspector and page headings a visible focus
   indicator. When the non-modal inspector is closed through its return link,
   move focus to the Missing Music page heading after the route has rendered.

## Keyboard model

| User action | Focus destination | Rationale |
| --- | --- | --- |
| Open a release from the worklist | Inspector `<h2>` | Announces the newly visible context without adding a custom widget. |
| Confirm Start download | Native modal dialog | Native dialog moves focus inside; a small Tab-wrap helper keeps forward and reverse Tab within it. |
| Escape or cancel the confirmation | Start download button | The native dialog returns focus to its invoker. |
| Use Back to release decisions | Missing Music `<h1>` | This is route navigation, so the new page context receives focus after render. |
| Complete a mutation | Current status heading | Announces the changed result without leaving focus on a removed control. |

The `<dialog>` has an accessible name, a visible Cancel action, and native
Escape support. Its content is structured rather than described as one large
string, so `aria-describedby` is intentionally not added.

## Security and accessibility requirements

- Scope and target-user selection are validated on every server request; the
  UI is not a security control.
- Unauthorized and nonexistent decisions are indistinguishable to the
  requester.
- The admin-only user filter is not rendered from a client URL claim; it is
  rendered only after the server returns `scope: "all"`.
- Focus order follows the newly visible context and never leaves a keyboard
  user on a removed element.
- Programmatic focus uses `tabindex="-1"` only for headings that provide
  meaningful page or inspector context. Those headings have a visible
  two-pixel focus outline using Harmoniarr tokens.

## Validation plan

1. Retain focused service coverage for requester-owned rows, no user
   enumeration, and cross-user detail rejection.
2. Replace stale Acquisition browser expectations with canonical legacy-route
   checks for both administrator and requester sessions.
3. Extend the Missing Music browser acceptance test to verify visible focus on
   the inspector title, native dialog focus containment and return, and focus
   on the Missing Music page heading after return navigation.
4. Run focused client, server, and browser suites; then lint, build, and the
   repository validation command before committing.

## Sources checked 2026-08-27

- [W3C WCAG 2.2 — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [W3C HTML technique H102 — native modal dialogs](https://www.w3.org/WAI/WCAG21/Techniques/html/H102)
- [W3C ARIA APG — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [W3C WCAG 2.2 — new success criteria, including Focus Not Obscured](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
