# Match Diagnostics Find Match Tool Design

## Status

Implemented on 2026-07-29.

## Problem

The Match diagnostics page had already been reduced to a recovery-first
workspace, but a fixed left rail still placed every saved match, raw source
filter, and folder result beside the current recovery state. It consumed a
large portion of the page on every visit and made choosing an alternative look
like part of normal music automation.

Saved matches are useful for exceptional diagnosis. They are not the normal
way to start, monitor, or recover a download. Music Queue remains that normal
surface.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [HTML Standard: details and summary](https://html.spec.whatwg.org/multipage/interactive-elements.html) | Use a native disclosure with a conforming summary structure so the control retains browser and assistive-technology behavior. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use a native disclosure so the advanced result list is keyboard-operable and exposes its state without a custom interaction model. |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep finder selection behavior coherent with the recovery flow; when a result is chosen, close the finder and return focus to the selected-match recovery card. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep raw folder and source search filters inside authenticated advanced diagnostics rather than default page content. |

## Options

### Keep the permanent filter rail

Pros: all saved matches are always visible; no extra interaction for an
operator.

Cons: competes with the recovery state, reserves empty width, and presents
manual source selection as a routine workflow.

### Remove saved-match lookup entirely

Pros: smallest page and strongest automation-first posture.

Cons: removes a useful way to compare an alternative source during exceptional
recovery.

### Use one compact Find a match disclosure

Pros: preserves filters, source context, matching results, and selection while
keeping the default route focused on recovery. It also avoids a permanent
two-column layout and unnecessary nested panels.

Cons: an operator opens one disclosure before filtering or choosing another
match. That cost is appropriate for an exception action.

## Final Recommendation Stack

1. Keep Match diagnostics an admin-only exception route and Music Queue the
   normal automation surface.
2. Replace the fixed result rail with one full-width native `Find a match`
   disclosure.
3. Keep the disclosure closed on ordinary visits and direct candidate/file
   links. Those links already select the target recovery card and open file
   evidence when necessary; expanding the finder would be redundant.
4. Close the finder after the operator chooses a result, then focus the
   selected-match recovery card.
5. Use `Search reference`, `Source user`, and `Matching results` in visible
   copy. Preserve existing API query keys and internal candidate identifiers
   for compatibility.

## Implementation

- `ImportReviewMatchFinder.vue` owns the native disclosure, its compact state
  summary, and result-selection collapse behavior.
- `ImportReviewView.vue` now has a single-column recovery layout: the optional
  finder, then the selected-match recovery workspace. Background status
  summaries are in the separate Current automation disclosure.
- `ImportCandidateFilters.vue` is a compact form inside the finder instead of
  a nested panel. `ImportCandidateQueueList.vue` is a labelled results section
  with match-oriented copy and no outer panel of its own.
- Existing query parameters, source filtering, candidate selection, file
  focus, and run-link behavior are unchanged. Manual alternative selection
  focuses the recovery card after the finder closes.

## Security Boundary

This is a client presentation refactor. It creates no route, mutation,
persistence, provider request, or authorization bypass. The finder remains
admin-only, and server authorization, fresh-session checks, and CSRF
enforcement continue to protect all state changes. Folder paths and provider
search references remain inside the existing authenticated diagnostics route;
the default recovery route does not copy them into its summary.

## Verification

- Browser checks prove a direct candidate/file route selects and focuses its
  recovery target while `Find a match` remains collapsed.
- Browser checks prove the finder opens on demand, can select an alternative,
  closes afterward, and returns focus to the recovery workspace.
- Client and test lint, production build, ESM checks, full tests, and a local
  no-cache walkthrough Docker rebuild are release gates.

## Outcome

Match diagnostics no longer reserves a candidate-first side rail. Operators see
the current recovery state first and can deliberately open a compact finder
only when an alternative match is needed.

## Next High-Value Item

The selected-match and pending-library status summaries now live in a compact
`Current automation` disclosure with a Music Queue handoff. See
[Match Diagnostics Current Automation Design](MATCH_DIAGNOSTICS_CURRENT_AUTOMATION_DESIGN.md).

Next, replace the Match diagnostics header `visible matches` counter with an
intent-specific recovery summary and keep result counts entirely inside `Find a
match`.
