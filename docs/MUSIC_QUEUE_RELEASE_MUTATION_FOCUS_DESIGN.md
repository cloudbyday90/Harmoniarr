# Music Queue Release Mutation-Focus Design

Status: Adopted 2026-08-23

## Purpose

Music Queue actions can update the selected release without leaving the
workspace. Selecting or rejecting a match, restarting a search, changing a
quality choice, retrying release details, or starting a safe library add can
replace the control that started the action. If a browser removes that focused
control without a deliberate fallback, keyboard focus can fall to the document
body and the operator loses their place.

This design preserves focus on an invoked action while the control remains.
Only when that control is removed does it move focus once to the updated
outcome heading in the same release inspector. Existing action feedback keeps
announcing progress, success, and errors; the feedback itself does not receive
focus.

## Official Research

Official W3C/WAI sources were identified and reviewed on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [WAI-ARIA 1.3: `status` role](https://www.w3.org/TR/wai-aria-1.3/#status) | Status information is a polite, atomic live region; authors should ensure it does not receive focus when status changes. | Retain the existing feedback live regions and focus the semantic outcome heading only when a removed action leaves no active UI focus. |
| [WCAG 2.2: Status Messages](https://www.w3.org/TR/wcag/#status-messages) | Assistive technology should receive action results without an unnecessary context change. | A result that leaves its control intact is announced without a focus jump. |
| [APG: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Focus must remain visible and logical when an action removes the active control; otherwise browsers can move it to the document body. | After render, move focus to the current-status heading only if the formerly focused control has disconnected and focus is at the body. |
| [APG: Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Focus following activation depends on the action; a command that remains in context ordinarily keeps focus. | Do not re-focus or otherwise override a retained action control. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Always focus the outcome heading after every action | Makes changes immediately obvious. | Interrupts keyboard flow and steals focus from a control that remains useful. | Reject. |
| Leave focus entirely to browser defaults | Minimal code. | Loses focus to the document body when Vue removes the action control. | Reject. |
| Focus the action-feedback live region | Brings the result into view. | Conflicts with WAI-ARIA guidance that `status` should not receive focus and duplicates the screen-reader announcement. | Reject. |
| Preserve the retained control; focus the outcome heading only after its removal | Keeps the common path quiet, restores a lost keyboard location, and keeps the outcome visible. | Needs an ephemeral action token, post-render DOM check, and interaction coverage. | Adopt. |

## Interaction Contract

```text
Keyboard action -> action result renders
  -> invoking control is still connected: keep existing focus unchanged
  -> invoking control is removed and focus falls to document body:
       focus the updated Current status heading once
  -> user has moved focus before completion: preserve that newer focus
```

The contract applies to match, recovery, quality, and safe-library-add actions
that update the selected release. It does not add a modal, new keyboard
shortcut, route change, or forced focus for mouse users whose browser did not
focus the action.

## Implementation Design

- A pure ESM controller records a short-lived mutation token, its invoking DOM
  target, and whether that target owned focus at activation.
- A focused Vue composable waits for the post-action render, confirms the
  target was removed and that the document has fallen back to its body, then
  focuses the inspector's `Current status` heading.
- The review panel exposes that semantic heading using `tabindex="-1"` solely
  for programmatic recovery; the existing `role="status"` and `role="alert"`
  feedback remains unfocused.
- Each action passes its native initiating button to the view. The view owns
  the action lifecycle and asks the composable to recover focus after a
  completed detail refresh.
- Unit tests cover retained, removed, stale, and superseded focus cases. A
  browser test verifies a keyboard-activated match selection lands on the
  visible updated outcome when its action controls disappear.

## Security Boundary

The implementation stores only ephemeral DOM references and numeric tokens in
client memory. It does not serialize controls, action results, or focus state
to a route, storage, provider request, API endpoint, audit record, or
background job. Existing server authorization and CSRF-protected mutation
paths remain unchanged.

## Final Recommendation Stack

1. Use native buttons and existing scoped live regions for action feedback.
2. Keep focus on the invoked control whenever it survives the update.
3. After render, repair focus only when that focused control has been removed
   and the browser has fallen back to the document body.
4. Focus a visible semantic outcome heading, never a `status` or `alert` live
   region.
5. Keep the policy in a pure ESM controller and render checks in a small Vue
   composable, with browser coverage for the actual mutation transition.
