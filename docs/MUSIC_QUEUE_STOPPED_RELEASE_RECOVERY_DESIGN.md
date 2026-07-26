# Music Queue Stopped-Release Recovery Design

Status: **Implemented - 2026-07-26**

## Goal

Make Music Queue distinguish routine automatic recovery from a release that has
actually stopped and needs one deliberate user decision. A normal user should
never have to infer that distinction from candidate, provider, or operation-run
details.

## Problem

The prior status projection could describe a failed match as `Trying next
match` while still offering a `Review match` action. Scheduled rediscovery was
also presented as generic waiting or as a terminal no-match state. This made
automatic work look like manual work and sent people toward the older wanted
and candidate-oriented surfaces.

## Research

- W3C requires errors to be identified in text rather than color alone, which
  supports explicit stopped-release labels and explanations rather than a red
  status treatment alone. [WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
- When a correction is known, W3C recommends describing it. The stopped states
  therefore name one available retry action instead of a generic failure.
  [WCAG 2.2 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
- Dynamic progress should use a polite status mechanism rather than stealing
  focus. The normal Music Queue update remains a normal page status and does
  not use an interruptive alert. [WAI-ARIA `status` technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
- Apple recommends feedback close to the affected item and alerts only when the
  importance warrants interruption. Recovery is therefore described on the
  release row and selected-release panel, not as a global alert. [Apple Human Interface Guidelines: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback?changes=_9)

## Decision

The release-status service owns the recovery contract. The client derives only
safe presentation from that status. No new mutation endpoint is added.

| State | Meaning | Normal action |
| --- | --- | --- |
| `trying_next_match` | A match failed or was rejected, and another eligible match already exists. | `View recovery`; Harmoniarr continues automatically. |
| `retrying_search` | A prior search has a scheduled cooldown or rediscovery attempt. | `View recovery`; Harmoniarr searches again automatically. |
| `no_matches_left` | Automatic match recovery is exhausted. | `Review recovery`, then `Search again`. |
| `failed` | The latest discovery search did not finish. | `Review recovery`, then `Try again`. |

`retrying_search` requires a bounded existing search attempt, a recognized
automatic request state (`ready` or `cooldown`), and a valid scheduled retry
timestamp. A new, never-searched release remains `queued_for_search`.

## Options Considered

### Keep One Generic Needs-Help State

Pros: smallest change and fewest statuses.

Cons: obscures whether the system is still working, invites unnecessary user
intervention, and cannot provide a precise retry action.

### Put Recovery Controls on Every Queue Row

Pros: immediate access to controls.

Cons: makes routine automation look broken, duplicates actions, and encourages
retries while a safe automatic fallback is still running.

### Separate Automatic And Stopped Recovery

Pros: matches the actual workflow, keeps active releases calm, reserves action
controls for a real decision, and makes browser verification deterministic.

Cons: adds one derived status and a small presentation module.

## Final Recommendation Stack

1. Derive automatic versus stopped recovery in the server-owned Music Queue
   status service.
2. Use a small client presentation module for home-user copy and retry labels.
3. Keep one primary release-row action; do not render a second `Details`
   control when the primary action already opens the same panel.
4. Keep retry behind the selected release panel and existing authenticated,
   fresh-session, CSRF-protected release-scoped retry route.
5. Keep provider error detail, source usernames, search identifiers, raw match
   details, and paths in Advanced diagnostics only.

## Security And Privacy

- This change uses existing status and scheduled-time evidence only; it does
  not add provider calls, credentials, or database writes.
- Public UI copy is static and allow-listed by status code. It does not render
  `blockedReason`, provider queries, raw candidate evidence, or file paths.
- The only mutation remains the existing release-scoped retry endpoint, which
  rechecks session scope and CSRF protections server-side.
- The recovery-panel retry control is available only after a terminal state;
  automatic recovery does not expose a competing mutation.

## Validation

- Server status tests cover pending next-match recovery, scheduled automatic
  retry, and terminal exhausted recovery.
- Client presentation tests cover action mapping, summary counts, recovery
  copy, and retry labels.
- Playwright browser verification covers desktop and mobile queue rows,
  automatic recovery without a retry control, and terminal recovery with one
  `Search again` action.

## Follow-Up

The next high-value reliability slice is blocking automatic provider enqueue
when managed folders are not ready. This prevents a transfer from being started
when Harmoniarr cannot safely complete the later library-add path.
