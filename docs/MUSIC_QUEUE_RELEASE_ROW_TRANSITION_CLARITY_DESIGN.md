# Music Queue Release-Row Transition Clarity Design

Status: **Implemented 2026-07-30.**

## Problem

After a person chooses a match, starts another search, or allows fallback
quality, Music Queue receives an updated release projection from the mutation
endpoint. The client previously discarded that projection and waited for a
list reload. The release row could therefore continue to show the former
decision state even though Harmoniarr had already scheduled the next automatic
step.

The normal queue must make that handoff clear without requiring a person to
reopen the release review or Advanced diagnostics, and without creating a
second notification feed.

## Existing Contract

- Each scoped Music Queue mutation returns `release`, projected by the same
  server service used by the bounded queue read.
- `useMusicQueue` owns mutation state and the subsequent list revalidation.
- `MusicQueueReleaseRow` is deliberately compact: current status, identity,
  one reason, bounded facts, and one action. Candidate and provider evidence
  remains in the selected review or Advanced diagnostics.
- The route-level fresh-session, CSRF, app-user release ownership, match
  ownership, and mutation rate limits remain unchanged.

## Research

Sources were checked on 2026-07-30 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | State changes caused by an action need programmatically determinable feedback without moving focus. |
| [W3C ARIA22: `status` role](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) | Keep ordinary asynchronous action feedback polite and contextual rather than interrupting the user. |
| [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Do not change focus or navigation order merely because a background transition advanced. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Do not promote raw provider errors, paths, identifiers, or secrets into routine status presentation. |

## Options

### Wait only for the list reload

Pros: one read-model update path.

Cons: a successful mutation can leave the selected row visibly stale until the
follow-up request returns, which weakens the automation handoff.

### Synthesize an optimistic next state in the browser

Pros: immediate visual response without depending on the mutation response.

Cons: client logic can drift from server status precedence and can incorrectly
claim a download, check, or add was scheduled.

### Apply the authoritative mutation projection, then revalidate

Pros: the row updates immediately from the server-authoritative state, the
existing bounded refresh corrects concurrent changes, and no duplicate status
machine is created in the browser.

Cons: queue summary totals can remain briefly stale until the existing refresh
finishes; the release row is intentionally prioritized because it is the
action's direct context.

## Decision

Adopt the authoritative mutation-projection option.

1. `useMusicQueue` normalizes `payload.release` from a successful mutation and
   replaces only the matching release in its current bounded read model.
2. It immediately starts the existing `resource.load()` revalidation. A failed
   revalidation retains the authoritative row projection and reports the
   existing page-level queue read error.
3. A small ESM presentation helper maps only known automatic queue states to a
   concise `Up next` message. Unknown, complete, and human-decision states do
   not receive an invented automatic-step claim.
4. `MusicQueueReleaseRow` renders the resulting line between the current
   reason and compact facts. It adds no action, disclosure, diagnostic data,
   polling, route mutation, or focus movement.
5. The existing selected-review feedback remains the only live action-result
   announcement. The row is a durable visual explanation of the updated
   release state, not a second live-region feed.

## Automatic Transition Copy

| Current state | `Up next` message |
| --- | --- |
| Queued for search | Harmoniarr will automatically search for a matching release in the next pass. |
| Searching | Harmoniarr will automatically check the best results against the selected quality settings. |
| Checking matches | Harmoniarr will automatically queue the selected match for download when its checks finish. |
| Downloading | Harmoniarr will automatically check the files, then add them to the library. |
| Ready to add | Harmoniarr will automatically add the verified files to the library. |
| Adding to library | Harmoniarr will finish adding the files and update this release. |
| Trying another match | Harmoniarr will automatically try the next eligible match. |
| Searching again automatically | Harmoniarr will automatically search again after the retry delay. |

## Recommendation Stack

1. Treat the mutation-returned release as the immediate release-row truth.
2. Continue the current bounded queue read after every successful mutation to
   reconcile totals and concurrent worker changes.
3. Keep transition copy in one pure ESM helper keyed only by known server
   status codes.
4. Keep one visual `Up next` cue in the row; retain live success/failure
   feedback only in the selected release review.
5. Keep raw candidates, provider responses, filesystem paths, and recovery
   internals in the existing diagnostics boundary.

## Security And Accessibility

- No authorization, CSRF, ownership, rate-limiting, provider, persistence, or
  secret-handling behavior changes.
- The browser accepts only the existing authenticated mutation response and
  only replaces a same-ID release in its current in-memory read model.
- The helper has no fallback message for unknown states, preventing accidental
  claims about unrecognized server transitions.
- Existing polite release-scoped action feedback remains the sole live status
  announcement, and focus stays on the initiating control.
- The new row copy is concise, text-based, and free of raw provider payloads,
  candidate IDs, local paths, credentials, or diagnostic errors.

## Verification

- Pure client tests cover automatic transition copy and prove attention states
  do not show a false automatic handoff.
- Composable tests prove a successful mutation applies its returned release
  before the bounded list revalidation completes.
- Playwright browser coverage proves a successful match selection changes the
  row to `Checking matches`, displays `Up next`, stays understandable after
  the review is closed, and has no desktop or mobile horizontal overflow.
- Client/test lint, ESM consistency, full Node tests, production build, and
  production dependency audit are validation gates.

## Outcome

- Music Queue immediately applies the server's returned release projection
  after a successful scoped mutation while retaining the existing list
  revalidation.
- Release rows now show one compact `Up next` statement for recognized
  automatic states, making the scheduled handoff visible in normal queue use.
- Human-decision, complete, and unknown statuses remain free of speculative
  automation messaging; detailed evidence remains behind the existing review
  and diagnostics boundaries.

## Follow-up

The next high-value automation slice is to extend terminal match recovery to
**timeout, disappeared-source, failed-quality-verification, and import-blocker
outcomes**, promoting the next eligible match only when the existing quality
and safety policy permits it.
