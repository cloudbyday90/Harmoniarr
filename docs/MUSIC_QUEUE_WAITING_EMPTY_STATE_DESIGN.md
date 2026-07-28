# Music Queue Waiting And Empty-State Design

Status: **Implemented 2026-07-26.**

## Purpose

Music Queue previously used one generic empty message when no rows were shown,
and its automatic-waiting summary did not clearly say whether the user needed to
act. That made three materially different situations look similar:

1. The download provider or its setup needs repair.
2. Harmoniarr is waiting until an automatic search is due.
3. There is no queued music at all.

This slice makes those states intentional without restoring a dashboard of
zero-value cards or turning routine automation into an alert.

## Research

The implementation follows current official guidance:

- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  describes exposing relevant status changes without an unexpected focus move,
  including progress and waiting states.
- [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  requires focus order to preserve meaning and operability; the page keeps the
  status explanation before the release list and before its optional Discover
  link.
- [W3C WAI-ARIA Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  limits alerts to brief, time-sensitive information. Normal waiting and an
  empty queue are stable page content, not alerts.
- [Apple Human Interface Guidelines: Writing](https://developer.apple.com/design/human-interface-guidelines/writing?changes=l_1)
  recommends contextual empty states that guide the next step without placing
  essential information only in the empty state.

## Options Considered

### Keep the generic empty panel

Pros: smallest change and no new component.

Cons: confuses a healthy clear queue with waiting work and setup problems; the
user cannot tell whether to wait, configure, or investigate.

### Use warning cards for waiting and empty states

Pros: makes every state conspicuous.

Cons: treats healthy automation as an exception, produces visual noise, and
risks repeated status announcements for a state that does not require action.

### Layer setup repair, automatic waiting, and a clear queue

Pros: the page communicates one accurate next step for each state, preserves
the existing Connections repair path, and keeps automatic success calm.

Cons: state explanation is intentionally distributed across a compact overview,
a provider repair notice, and the empty panel instead of one large banner.

## Decision

Adopt the layered state model.

| Condition | Presentation | User action |
| --- | --- | --- |
| Provider disabled, incomplete, unreachable, or unhealthy while work is queued | Existing `MusicQueueProviderRepairNotice` | Use the one Connections setup/repair handoff. |
| Releases are `queued_for_search` and nothing is otherwise active or blocked | The Current work empty state says no action is needed and gives one `View scheduled releases` handoff | Wait for Harmoniarr's normal search schedule or inspect scheduled releases intentionally. |
| No release exists in Music Queue | `MusicQueueEmptyState` shows `Queue is clear` and `Nothing needs your attention` | Optionally open Discover to monitor another artist. |

`music-queue-status-presentation.js` is the pure state-priority module.
`MusicQueueEmptyState.vue` owns only the clear-queue display and a normal router
link; `MusicQueueView.vue` selects it only when there are no release rows.

No polling, dispatch, provider call, route parameter, or mutation was added.

## Security And Accessibility

- The change is presentation-only and introduces no new API read, write,
  authorization decision, secret, provider detail, or URL input.
- Provider repair remains delegated to the established notice and its bounded
  Connections route. A healthy empty state never claims that a download has
  started or completed.
- Waiting is plain visible text, not a live alert. This avoids interrupting
  assistive technology for stable, routine automatic work.
- The page keeps meaningful DOM order: state explanation, then queue content or
  the optional Discover link.
- The clear-state action is a native router link with a descriptive accessible
  name. The compact mobile layout stacks safely without horizontal overflow.

## Validation

- `npm run lint:client`
- `npm run lint:test`
- `node --test test/client/music-queue-status-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/music-queue-waiting-empty-state-browser-verification.test.js`
- `node --test --test-concurrency=1 test/browser/music-queue-provider-repair-context-browser-verification.test.js`

The new browser proof captures automatic waiting on desktop and a clear queue on
mobile. It verifies the explicit no-action-needed copy, the safe Discover
handoff, absence of a conflicting empty state while waiting, a closed mobile
drawer before capture, and no horizontal overflow.

## Recommendation Stack

1. Keep setup/provider repair as the only prominent interruption when queued
   work cannot progress.
2. Describe scheduled work as automatic and explicitly say when no user action
   is needed.
3. Treat a zero-release queue as a calm completion state, with a single
   optional discovery path rather than operational controls.
4. Keep detailed release recovery facts in the release row or advanced
   diagnostics, not in a healthy empty state.

## Follow-Up

The next high-value slice is **Music Queue stopped-release recovery hierarchy**:
make `no matches left`, failed search, and retrying-next-match rows distinguish
automatic recovery from a genuine user decision with one specific action.
