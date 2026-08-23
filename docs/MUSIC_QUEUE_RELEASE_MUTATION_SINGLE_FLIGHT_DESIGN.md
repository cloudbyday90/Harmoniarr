# Music Queue Release Mutation Single-Flight Design

Status: Adopted 2026-08-23

## Purpose

Music Queue presents several valid choices for one selected release. Before
this change, starting one match action only marked that match card busy. A
second match card, or another release-level action, could still be activated
before the first request returned. That creates competing operator decisions
and makes the outcome depend on request timing.

The selected-release inspector now permits one mutation at a time. It keeps
the active action visible and focused, makes every competing action
unavailable, and leaves the scoped progress message in place until the request
finishes.

## Official Research

Primary guidance was discovered and reviewed on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [WAI-ARIA APG: Focusability of disabled controls](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Native `disabled` removes a control from the tab sequence; `aria-disabled` is appropriate when a disabled control must remain discoverable or retain focus. | Preserve the exact active action with `aria-disabled`; use native `disabled` on every competing control that the adjacent active action and status already explain. |
| [WAI-ARIA APG: Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | A button whose action is unavailable conveys `aria-disabled`; after an in-place command, focus ordinarily remains in context. | Keep the invoked button in place during its request and retain the existing scoped status message as its accessible description. |
| [WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Sequential keyboard focus must preserve meaning and operability; non-operable tab stops should be avoided when they make operation tedious. | Do not add every temporarily unavailable action to the tab sequence. The only focusable unavailable control is the one that already has focus. |
| [OWASP: CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | State-changing browser requests need a server-side CSRF defense in addition to client behavior. | Keep all existing CSRF-protected mutation calls unchanged; the client gate is usability and race reduction, not an authorization control. |
| [IETF HTTPAPI idempotency-key draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header) | A resource that recognizes duplicate mutations can return a conflict while a prior matching request is active, then replay the completed result for a retry. The document is an expired Internet-Draft, not a published RFC. | Do not add a speculative HTTP header now. Use it as input to the next, server-side release-invariant design after release ownership and durable result storage are defined. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Visual-only busy state on the initiating button | Minimal component change. | A second handler can still begin before reactive rendering completes; other controls look usable. | Reject. |
| Native-disable every action, including the active control | Browser blocks activation with little code. | Removes keyboard focus from the control that initiated the request and conflicts with the existing focus-recovery contract. | Reject. |
| One client-side gate plus mixed disabled semantics | Synchronously rejects a second action before network work, preserves active focus, reduces tab stops, and keeps the outcome local to the release. | Protects one in-memory client instance only. | Adopt. |
| Database-backed release winner and idempotent mutation results now | Protects simultaneous requests from tabs, browsers, and processes. | Requires an explicit ownership model for shared discovery candidates, a transaction boundary, migration, and durable response policy. | Defer as the next dedicated server-side item. |

## Interaction Contract

```text
Start one release action
  -> synchronously claim the client mutation gate
  -> active action remains focusable and exposes its working status
  -> competing match actions become natively disabled
  -> competing release actions become natively disabled
  -> a second handler call returns without an API request or feedback overwrite
  -> request completes, errors, or refreshes
  -> release the gate and restore normal availability
```

The gate is intentionally scoped to a `useMusicQueue` instance, where Music
Queue has one selected release inspector. It applies equally to selecting or
rejecting a match, searching again, allowing fallback quality, rechecking a
safe add, and adding to the library.

## Implementation Design

- `music-queue-release-mutation-gate.js` is a pure ESM state module. It owns
  only acquisition, release, normalization, and the active wanted-release ID.
- `useMusicQueue.js` acquires that gate before setting action keys or calling
  an API. Its `finally` path releases the gate for success, handled API errors,
  and thrown errors.
- `MusicQueueView.vue` passes the active wanted-release ID to the selected
  inspector; no route, request shape, persistence model, or provider contract
  changes.
- `MusicQueueReviewPanel.vue` disables all release actions while the selected
  release is mutating and passes the same state to match cards.
- `MusicQueueReviewMatchCard.vue` keeps only the invoked match action
  focusable via `aria-disabled`. All other actions are native-disabled, and its
  defensive event guard remains in place.
- Focus feedback continues to use the established status and focus-recovery
  design. This change adds no modal, confirmation, toast, global alert, or new
  keyboard shortcut.

## Security Boundary

The gate contains only a transient release ID in client memory. It stores no
data and changes no API, session, CSRF, audit, provider, filesystem, or
background-job behavior. Server routes continue to require a fresh session and
CSRF validation; import-candidate status changes continue to use conditional,
transactional status transitions.

This is not a server concurrency guarantee. Separate tabs or app processes can
still submit competing candidate mutations, so the next item must establish a
server-side release winner rather than treating the interface guard as a
security boundary.

## Final Recommendation Stack

1. Synchronously gate all selected-release mutations in the client before an
   API call begins.
2. Retain focus only on the exact active action with `aria-disabled` and a
   scoped working description.
3. Native-disable competing actions so keyboard users do not tab through a
   temporary dead end.
4. Keep existing fresh-session and CSRF checks; do not add client-only
   authorization logic or persist UI state.
5. Next, model and enforce one server-side selected candidate per owned release
   with a transaction, conflict response, and integration proof. Consider a
   durable idempotency result only after that invariant is explicit.
