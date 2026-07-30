# Music Queue Release Action Feedback Design

Status: **Implemented 2026-07-29.**

## Problem

Music Queue actions are release-scoped and safely authorized, but their
success and failure messages currently render above the entire queue. After a
person chooses a match, retries a search, or allows fallback quality, the
result appears far from the selected release and can be confused with another
release's state.

The queue needs a concise result near the selected release without adding a
toast stream, retaining stale notices indefinitely, or exposing diagnostic
details outside the release review.

## Existing Contract

- `useMusicQueue.js` owns mutation state, invokes the existing CSRF-backed
  release-scoped APIs, and refreshes the bounded Music Queue read model.
- `MusicQueueView.vue` owns the selected release and currently renders global
  mutation success and failure alerts above all queue content.
- `MusicQueueReviewPanel.vue` is the release-specific surface for match,
  retry, and fallback-quality actions.
- Server routes already require a fresh session, CSRF token, app-user release
  scope, and bounded match ownership. This slice must not alter those controls.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Report asynchronous progress and success with a programmatically determinable status without moving focus. |
| [W3C ARIA19 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19) | Use an existing live-region container for failures so assistive technology announces the newly inserted error without a focus jump. |
| [W3C WCAG 2.2: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) | Failure text must identify what failed in clear text, rather than relying on color or a generic state change. |
| [WAI-ARIA 1.2 live regions](https://www.w3.org/TR/wai-aria/) | Use polite status for ordinary progress/success and reserve assertive alert behavior for important action failures. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Do not add client logging or surface raw provider payloads, paths, or secrets as action feedback. |

## Options

### Keep global queue banners

Pros: no component or state changes.

Cons: feedback is disconnected from the action and becomes ambiguous when
multiple releases are visible.

### Use transient global toast notifications

Pros: familiar interaction pattern and no panel layout change.

Cons: feedback disappears before a person can relate it to the release, can
stack noisily, and is still detached from the action context.

### Keep one bounded release-keyed result in the selected review

Pros: feedback stays beside the release workflow; supports working, success,
and failure states; preserves focus; and retains only one bounded record.

Cons: the outcome is visible only while that release is selected, and a new
action replaces the prior result.

### Persist action notices in Activity

Pros: durable history across sessions.

Cons: duplicates the existing audit/activity responsibility and would make a
short-lived UI confirmation into a noisy operational event.

## Decision

Adopt a pure ESM feedback-presentation helper, a single release-keyed
composable record, and a compact review-panel notice:

1. `useMusicQueue` replaces global mutation strings with one feedback object
   containing the release ID, action key, phase, and already-sanitized display
   message.
2. Each mutation sets `working`, then either `success` or `error`; existing
   button labels remain the immediate progress affordance.
3. The selected `MusicQueueReviewPanel` renders feedback only when its release
   ID matches the feedback record. Progress and success use `role="status"`;
   failures use `role="alert"`.
4. Queue-load errors remain page-level because they describe the entire view,
   not an individual release action.
5. The record is bounded to the latest action. It is not persisted, logged,
   routed, or exposed to another user.

## Recommendation Stack

1. Retain one short-lived, release-keyed feedback result in the Music Queue
   composable rather than a global notification stream.
2. Render it only in the selected release review: polite `status` for working
   and successful changes, assertive `alert` for an action failure.
3. Keep the initiating action focusable with `aria-disabled` plus a guarded
   handler while the request is active. This prevents duplicate submission
   without native-disabled focus loss.
4. Keep queue-read failures at the page level and reserve persisted Activity
   events for actual pipeline history rather than UI acknowledgements.
5. Keep feedback bounded and sanitized; do not add provider payload, local
   path, credential, or diagnostic logging to the normal Music Queue path.

## Security And Accessibility

- Presentation only: no mutation route, API payload, authorization rule,
  provider call, persistence path, or secret handling changes.
- Existing fresh-session, CSRF, release-ownership, and match-ownership checks
  remain the authority for every action.
- Feedback uses text plus semantic role and tone; no outcome relies on color.
- No automatic focus movement occurs, preserving the operator's active control
  and preventing focus churn when a refreshed release projection changes.
- Display text stays within the existing normalized API-error boundary; no raw
  provider responses, local paths, or credentials are promoted to the UI.

## Verification Plan

- Pure ESM tests cover phase-to-role/tone presentation and release scoping.
- Composable tests cover working, success, and failure feedback without
  changing load failures into action feedback.
- Browser verification checks success and failure remain inside the selected
  release review, global action alerts are absent, keyboard focus stays on the
  initiating control after failure, and mobile layouts do not overflow.
- Client/test lint, ESM checks, full tests, production build/audit, and a
  no-cache local Docker walkthrough rebuild are release gates.

## Outcome

- Music Queue now retains one bounded, release-keyed feedback record instead of
  global mutation banners.
- The selected release review announces working and successful actions with
  `role="status"`, and failures with `role="alert"`. Focus remains on the
  initiating button through a guarded `aria-disabled` action state.
- Page-level errors remain reserved for Music Queue read failures; action
  feedback cannot be confused with another release's state.
- Focused presentation, composable, and browser tests cover the phase,
  release-scope, success, failure, focus, desktop, and mobile contracts.

## Follow-up

The next high-value Music Queue slice is **release-row transition clarity**:
after an action succeeds, the row should make the newly scheduled automatic
step immediately recognizable without requiring a person to reopen the review
or diagnostics.
