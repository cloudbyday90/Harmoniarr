# Music Queue Release Focus-Origin Design

Status: Adopted 2026-08-23

## Purpose

Music Queue uses a conditional, non-modal release inspector. That preserves
the queue context while an operator checks a release, but it also creates two
legitimate entry paths with different focus expectations:

- A release-row action keeps its current keyboard focus when the adjacent
  inspector opens. Closing the inspector must return to that same action.
- A copied, bookmarked, or Activity-provided release URL has no in-page
  trigger. Once its detail state is ready, focus needs a stable descriptive
  destination; when it closes, the queue heading is the logical fallback.

Previously the route retained the selected release ID but not the interaction
origin. Closing the inspector after a list activation could therefore leave
focus on a removed Close button or the document body.

## Official Research

Official W3C/WAI sources were reviewed on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Focus order must preserve meaning and operability; content changes must not create a confusing focus sequence. | Opening from a row does not steal focus. Closing returns to the exact origin control when it remains connected. |
| [WCAG 2.2: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | A keyboard focus indicator must be at least partly visible. | Programmatic targets are focusable headings with a two-pixel accent outline; the non-modal inspector keeps the queue available. |
| [WAI-ARIA APG Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Removing the focused element without managing focus commonly causes focus to fall to the document body. | Capture the close target before the inspector is removed, then focus it after Vue renders the list-only state. |
| [WAI-ARIA APG Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | A dialog returns focus to its invoker on close, unless a different logical workflow destination is needed. | Apply the return-focus principle without adding dialog semantics, a focus trap, or `aria-modal`; the inspector remains an `aside` because the queue stays operable. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Always move focus into the inspector | Simple and makes its content discoverable. | Disrupts list scanning and invalidates the existing non-modal row behavior. | Reject. |
| Do not manage close focus | No additional state. | Focus can land on the document body after Close, which breaks the keyboard workflow. | Reject. |
| Infer a prior row from the selected route | Avoids retaining an element reference. | Cannot distinguish a copied/direct URL from a row activation and breaks with filters or a changed list. | Reject. |
| Retain ephemeral focus origin outside route state | Correctly differentiates row and direct origins while keeping deep links authoritative. | Requires a small controller and connection guard. | Adopt. |

## Interaction Contract

```text
Row action
  -> remember the action element in ephemeral UI state
  -> route selects the release
  -> inspector opens without moving focus
  -> Close removes inspector
  -> focus returns to the still-connected row action

Direct release URL
  -> route selects the release
  -> detail resolves
  -> focus moves once to the inspector heading
  -> Close removes inspector
  -> focus moves to the queue list heading
```

If the retained row action no longer exists, the queue list heading is used as
the safe fallback. The route remains the selected-release source of truth;
the controller stores neither serialized DOM data nor a user-controlled route
payload.

## Implementation Design

- `music-queue-release-focus-controller.js` is a pure ESM state module. It
  normalizes release IDs, records row or direct origin, ensures a direct URL
  moves focus only once after detail readiness, and chooses a close target.
- `useMusicQueueReleaseFocus.js` owns the Vue render boundary. It waits for
  `nextTick`, verifies a target is still connected, and records a direct-route
  focus only after its heading exists.
- `MusicQueueReleaseRow.vue` emits its activating element with the selected
  release. This is ephemeral component interaction data, not router state.
- `MusicQueueReviewPanel.vue` exposes its current heading and makes each
  panel-state heading programmatically focusable with a visible focus ring.
- `MusicQueueView.vue` synchronizes the controller with route selection,
  restores focus after Close, and focuses a direct-route heading only after
  the inspector has settled.

The inspector remains a labeled `aside`, not a dialog. It must not receive
`role="dialog"`, `aria-modal`, an inert queue, or a focus trap because it is a
master/detail workspace rather than a blocking interaction.

## Security Boundary

This is presentation-only focus management. It adds no API surface,
persistence, authorization path, or privileged mutation. The controller holds
only an in-memory release ID and a current DOM element reference; it does not
serialize the element into history, expose provider data, or modify release
state. Existing authenticated release-detail and action endpoints remain the
authorization boundary.

## Validation Plan

- Unit-test row-origin preservation, direct-route focus-once behavior, changed
  direct routes, render timing, and disconnected-target guards.
- Browser-test row-open/Close focus restoration and a direct URL's heading and
  queue-heading fallback, including visible focus outlines.
- Run client/test linting, client tests, the focused browser scenario, a
  production build, and the repository validation suite before commit.

## Final Recommendation Stack

1. Keep Music Queue as a non-modal, route-addressable master/detail view.
2. Store only ephemeral interaction origin outside the route.
3. Preserve row focus on open; restore it after Close when that row still
   exists.
4. Focus a direct URL's ready inspector heading once, then return Close to the
   queue heading.
5. Make every programmatic focus target visibly identifiable and avoid focus
   traps or hidden queue content.
