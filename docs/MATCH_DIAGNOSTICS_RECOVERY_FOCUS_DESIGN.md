# Match Diagnostics Recovery Focus Design

## Status

Implemented on 2026-07-29.

## Problem

The Match diagnostics header still displayed `N visible matches` even after the
candidate list moved behind the optional **Find a match** disclosure. That
number described an internal result set instead of the reason an operator had
opened the page. It also made the default advanced screen look like a queue
browser when its primary job is to explain and repair an exceptional match.

The result count must remain available when an operator deliberately opens the
finder, but it should not compete with recovery as the first thing the page
communicates.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html) | The header's compact label must describe the active purpose, not a generic implementation count. |
| [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Dynamic result counts belong with the result list they describe; do not make the page header a noisy live progress surface. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep the finder as the existing native disclosure, retaining ordinary keyboard behavior instead of adding a custom drawer. |
| [W3C WCAG 2.2: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | The short recovery-focus label must reflow beside or below the header without requiring horizontal scrolling. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep raw match totals, provider identifiers, paths, and file evidence inside authenticated diagnostic tools; do not add them to a default summary. |

## Options

### Retain the visible-match counter

Pros: no implementation work; gives experienced operators a quick indication
of list size.

Cons: implies that a result list is the primary task, duplicates the finder
context, and provides no direction for direct candidate, file, or
library-add recovery links.

### Replace the counter with a recovery-focus label

Pros: explains why the current diagnostic route was opened, keeps direct
candidate and file handoffs meaningful, and removes the last default
candidate-queue signal.

Cons: operators must open **Find a match** to see the exact result count; that
is intentional because the count only helps while inspecting alternatives.

### Remove all header context

Pros: the visually smallest header.

Cons: loses route-specific orientation for direct file, selected-match, and
library-add recovery links.

## Final Recommendation Stack

1. Replace the header count with a concise `Recovery focus` label generated
   solely from existing normalized route state.
2. Prefer route intent in this order: file issue, completed-download/library-add
   work, selected match, then the selected status filter. This keeps a
   status-only library-add handoff meaningful when the existing workspace
   selects a row for its recovery card.
3. Use plain labels such as `Fix a file issue`, `Review selected match`, and
   `Review library add` rather than internal candidate terminology.
4. Keep the existing total result text in `ImportCandidateQueueList`, which is
   rendered only after **Find a match** is expanded.
5. Remove the now-unused queue-summary projection from the workspace
   composable rather than carrying unused count state through the page.
6. Retain all existing routes, browser focus behavior, authorization, provider
   calls, and persisted state.

## Implementation

- `src/client/lib/import-review-recovery-focus-presentation.js` owns the
  bounded route-to-label mapping. It accepts only normalized route state and
  never receives candidate rows, paths, provider responses, or secrets.
- `ImportReviewView.vue` renders the compact recovery focus in the header and
  no longer reads `summaryPills` from `useImportReviewWorkspace`.
- `useImportReviewWorkspace.js` removes its unused candidate-count projection.
- `ImportReviewMatchFinder.vue` remains the only default-page component that
  can reveal a result count, through its already-disclosed result list.

## Security Boundary

This is presentation-only. It adds no route, API call, state mutation,
persistence, authorization behavior, provider polling, or client-side secret.
The header receives only explicit route state, so it cannot accidentally
render source-user names, folder paths, filenames, match scores, or provider
payloads. Exact totals remain in the authenticated finder that already
contains match evidence.

## Verification

- Pure client coverage proves direct file, selected-match, library-add,
  status-filter, and default recovery labels.
- Browser coverage proves the default header has a recovery focus instead of a
  visible-match counter and that an exact result count appears only after
  **Find a match** is open.
- Client lint, test lint, ESM checks, production build, focused browser
  verification, and a no-cache local Docker walkthrough rebuild are release
  gates.

## Outcome

Match diagnostics now opens as a recovery tool rather than a candidate list.
Operators receive a short explanation of the current diagnostic intent, while
the exact result volume remains available at the point where it is useful.

## Next High-Value Item

Unify the remaining advanced match-finder filters into one human-readable
`Search saved matches` form, hiding raw search-reference and source-user
filters until an operator explicitly expands a secondary filter group.
