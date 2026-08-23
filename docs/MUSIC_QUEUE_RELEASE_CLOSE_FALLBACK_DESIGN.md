# Music Queue Release Close-Fallback Design

Status: Adopted 2026-08-23

## Purpose

Music Queue is a non-modal list and release-inspector workspace. When an
operator opens a release from a row, Close normally returns focus to that row's
action. The row can disappear before Close, however, when the operator changes
a filter or the local queue refreshes. Returning focus to a removed action
leaves the keyboard at the document body instead of in the queue.

This design preserves the preferred row action while providing the visible
queue-section heading, then the persistent page heading, as deterministic
fallbacks. It changes only client-side, ephemeral focus management; it adds no
server state, background work, or hosted-service dependency.

## Official Research

Official W3C/WAI sources were identified and reviewed on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [WAI-ARIA 1.2: Managing Focus and Supporting Keyboard Navigation](https://www.w3.org/TR/wai-aria/#managingfocus) | When authors remove the focused element, focus should move to a logical element. Native HTML semantics should be preferred over unnecessary ARIA. | Close uses the existing semantic heading with `tabindex="-1"`; no custom widget, role, or extra keyboard model is introduced. |
| [WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Focus order must preserve meaning and operability and not appear to jump randomly. | Prefer the originating row action, then use the queue heading—the clear beginning of the remaining workspace. |
| [WCAG 2.2: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | A focused component must not be entirely hidden by author-created content. | Reuse the existing visible focus outline on the non-sticky queue heading after the inspector has unmounted. |
| [WAI-ARIA APG: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | DOM and tab order should remain logical; `tabindex="-1"` is appropriate for an element that needs programmatic focus but not a new tab stop. | Keep the heading out of the ordinary tab sequence while allowing an intentional Close fallback. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Return only the saved row action | Smallest implementation. | Fails when filtering or refresh removes that action. | Reject. |
| Check the row action before Close, then choose one target | Looks simple. | The target can still disconnect during Vue's subsequent render. | Reject. |
| Keep an ordered candidate list and try it after render | Handles the render boundary, preserves the preferred target, and has a stable fallback. | Adds a small candidate-resolution helper and tests. | Adopt. |
| Send focus to the document body or top-level page title | Always exists. | Loses the operator's place in the Music Queue workflow. | Reject. |

## Interaction Contract

```text
Row action -> selected release -> Close
  -> originating action still connected: focus that action
  -> originating action removed but queue remains: focus queue-section heading
  -> refresh removes all queued rows: focus Music Queue page heading

Direct release URL -> selected release -> Close
  -> focus queue-section heading, or page heading if the queue is empty
```

The fallback occurs only after Close is activated. It does not add an alert or
move focus while an operator is filtering, refreshing, or reading the
inspector. The heading's existing two-pixel outline provides the visual
location cue without changing normal Tab navigation.

## Implementation Design

- `music-queue-release-focus-controller.js` returns ordered, de-duplicated
  close-focus candidates: the row action when applicable, then the queue
  section heading, then the persistent Music Queue page heading.
- `useMusicQueueReleaseFocus.js` waits for Vue's next render and focuses the
  first candidate that remains connected and focusable. It owns DOM checks;
  the pure controller remains free of render-timing or browser concerns.
- `MusicQueueView.vue` clears the selected release, then delegates that
  candidate set to the composable. The route remains the selected-release
  source of truth.
- Client and browser tests cover retained row origin, disconnected row action,
  direct-route Close, visible focus outlines, a live filter that removes the
  opening row, and a refresh that empties the queue before Close.

## Security Boundary

The controller retains only short-lived DOM references already captured from
the user's current page. It serializes nothing into URLs, history, storage, or
server requests. The change adds no endpoint, authorization path, mutation,
or provider data exposure.

## Final Recommendation Stack

1. Keep Music Queue non-modal and preserve the originating row action when it
   still exists.
2. Resolve all focus targets only after the render that removes the inspector.
3. Use a logical, visible queue-heading fallback when the row is absent.
4. Keep the focus target programmatic-only with `tabindex="-1"`; do not add a
   custom ARIA widget or positive `tabindex`.
5. Regression-test the actual filter/removal workflow and the visual focus
   indicator.
