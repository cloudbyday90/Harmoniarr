# Music Queue Direct-Release Recovery Design

Status: Adopted 2026-08-23

## Purpose

A Music Queue release can be opened from a copied URL, a bookmark, or an
Activity link. The queue remains the useful working context when that detail
request is slow, the release is no longer available, or a temporary request
failure occurs. Replacing the entire page with an unavailable screen strands
the operator and hides the actions they can still take.

This design keeps the existing non-modal master/detail workspace visible and
gives the selected inspector a small, clear recovery state. It is deliberately
for a self-hosted application: it adds no hosted service, telemetry, queue
worker, or persistent retry mechanism.

## Official Research

Official W3C/WAI sources were reviewed on 2026-08-23.

| Source | Finding | Applied decision |
| --- | --- | --- |
| [ARIA22: Using `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) | A status message is a polite live region; `aria-atomic="true"` makes a changed message understandable as one announcement. | Retain the inspector's existing loading status and add an atomic, concise unavailable announcement without moving focus during a slow request. |
| [WAI-ARIA APG Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) | Alerts should not move keyboard focus, should not disappear automatically, and should be used only for important, time-sensitive information. | A temporary detail failure has a one-time alert announcement, while keyboard focus lands on the visible recovery heading where its actions can be understood. |
| [WAI-ARIA APG Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) | An alert dialog is modal and requires a real modal interaction model. | Do not use `alertdialog`, a focus trap, or an inert queue. The inspector is a non-modal `aside` because the list stays actionable. |
| [WCAG 2.2: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | When an error is detected, it should be described to the user in text. | State what is unavailable in plain language and give one or two relevant next actions instead of showing an opaque failure. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Replace Music Queue with a full-page unavailable state | Minimal component work. | Removes the queue and its routes even though they remain usable. | Reject. |
| Use a modal alert dialog | Demands immediate acknowledgement. | Breaks the master/detail model, needs modal behavior, and prevents queue comparison. | Reject. |
| Put a raw request error above the workspace | Fast to implement. | Can disclose provider or network details and gives no local recovery action. | Reject. |
| Use an inline, selected-inspector recovery state | Retains context, makes the next action visible, and works for direct URLs. | Requires a focused state model and an extra retry path. | Adopt. |

## Interaction Contract

```text
Direct Music Queue URL
  -> release detail is slow
  -> keep the queue visible; inspector reports loading politely
  -> do not move focus while work is pending

Direct Music Queue URL
  -> detail succeeds
  -> focus the release inspector heading once

Direct Music Queue URL
  -> release is unavailable (404)
  -> keep queue visible; focus a calm unavailable heading
  -> provide Return to Music Queue

Direct Music Queue URL
  -> detail temporarily fails
  -> keep queue visible; announce a concise failure
  -> focus the recovery heading
  -> provide Try again and Return to Music Queue
```

The recovery actions are local to the inspector. `Try again` repeats only the
existing release-detail `GET`; it does not retry downloads, mutate policy, or
start a background loop. `Return to Music Queue` clears only the selected
release route and returns focus to the queue heading for a direct entry.

## Implementation Design

- `music-queue-release-recovery-presentation.js` is a pure ESM presentation
  mapper. It classifies a known unavailable response separately from a generic
  retryable failure and never passes raw request text into the UI.
- `MusicQueueView.vue` retains the list workspace whenever the route selects a
  release, even when the list request has no rows. It sends the mapped
  recovery state to the inspector and connects `Try again` to the existing
  scoped detail loader.
- `MusicQueueReviewPanel.vue` renders a labelled recovery heading, concise
  explanation, and only the actions that make sense for that state. Its
  announcement is separate from controls so an ARIA alert never contains
  interactive elements.
- The existing release-focus controller treats either resolved detail or a
  resolved recovery state as ready for a direct URL. It makes one focus move
  only after the corresponding heading is rendered.

The inspector remains a labelled `aside`, not a dialog. Loading remains a
polite status. A generic retry failure has a short alert announcement but no
automatic retry, timeout, modal, or focus trap.

## Security Boundary

Only generic, operator-safe recovery copy reaches the client. Provider URLs,
transport details, upstream error messages, and server implementation details
are not rendered. The feature adds no endpoint, permission, persistence, or
privileged mutation. Existing authenticated release-detail access continues to
enforce authorization.

## Final Recommendation Stack

1. Keep Music Queue's list and selected-inspector model available for direct
   link failures.
2. Use a quiet loading status without a premature focus change.
3. Map known unavailable and temporary failures to distinct, generic recovery
   presentations.
4. Give temporary failures exactly one manual `Try again` action; do not add
   automatic retries.
5. Keep announcements non-modal and focus a visible heading with meaningful
   local actions.
