# Match Diagnostics Current Automation Design

## Status

Implemented on 2026-07-29.

## Problem

Match diagnostics had already moved recovery, match finding, evidence, and
operator run controls behind purposeful boundaries. Two full-width status
panels still remained in the default workspace, however: selected matches and
downloads waiting for a library step. They repeated background automation
state, competed with the selected-match recovery card, and exposed detailed
operational rows before an operator had asked to diagnose them.

Music Queue is the routine place to follow search, download, quality, and
library progress. Match diagnostics is an authenticated exception surface. Its
default screen should answer what needs recovery, not mirror a queue dashboard.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [HTML Standard: details and summary](https://html.spec.whatwg.org/multipage/interactive-elements.html) | Use native `details` and `summary` semantics for an optional block instead of recreating disclosure behavior. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep the optional diagnostic block keyboard-operable and expose its open state through native behavior. |
| [W3C WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Reflow diagnostic paths and metadata at narrow widths rather than clipping text or requiring two-dimensional scrolling. |
| [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Do not turn routine polling updates into a chatty live region; reserve status announcements for completed user actions or meaningful state changes. |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep direct recovery links focused on their selected match rather than opening unrelated background state first. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep raw paths and detailed diagnostic records inside the existing authenticated diagnostic surface and avoid rendering them by default. |

## Options

### Keep both status panels always open

Pros: the selected and library-add states are immediately visible.

Cons: the exception page remains busy, background automation competes with
recovery, and detailed rows are visible without a diagnostic intent.

### Move all status detail to Music Queue

Pros: Match diagnostics has the smallest possible default screen and one
normal workflow owns all automation progress.

Cons: status-specific diagnostic deep links lose local context and an operator
cannot compare recovery with selected/download state without leaving the route.

### Use a compact Current automation disclosure with a Music Queue handoff

Pros: preserves status detail and stable status links, makes routine progress
easy to hand off, and keeps only recovery visible by default.

Cons: an operator makes one deliberate expansion before reading detailed
selected or library-add rows. That is appropriate for exceptional diagnosis.

## Final Recommendation Stack

1. Keep the selected-match recovery card as the only always-visible
   operational block in Match diagnostics.
2. Place selected-match and pending-library status panels in a native `Current
   automation` disclosure, closed on ordinary route visits.
3. Use a compact count summary for selected matches, downloads waiting to add,
   and blocked items. Do not show a live region for normal polling refreshes.
4. Link the expanded disclosure to Music Queue for normal search, download,
   quality, and library progress.
5. Open the disclosure for status-only `selected` and `import_pending` route
   links so those diagnostic handoffs retain their local context.
6. Keep it closed for direct candidate and file links. The selected recovery
   card is already focused, and direct file links retain the existing evidence
   disclosure behavior.
7. Keep raw source paths, staging folders, and file rows inside the existing
   authenticated panels only after the operator expands a disclosure.
8. Preserve every existing API, authorization, query, and mutation contract.

## Implementation

- `import-review-current-automation-presentation.js` owns the compact count
  wording and the status-only route expansion policy.
- `ImportReviewCurrentAutomation.vue` owns the native disclosure, Music Queue
  handoff, empty state, and the existing selected/pending detailed panels.
- `ImportReviewView.vue` renders the recovery workspace first, then Current
  automation. It opens the disclosure only for status-only selected or
  pending-library route state.
- Shared review-panel reflow rules collapse nested metadata grids at narrow
  widths and wrap raw source, staging, and library paths without clipping
  diagnostic data.
- Existing selected-match recovery, evidence, matcher, run history, and
  route-state behavior remain unchanged.

## Security Boundary

This is a presentation-only change. It creates no endpoint, role, persistence,
provider, secret, or state-transition change. Requesters remain outside Match
diagnostics through the existing route guard. Administrators and operators keep
the same previously authorized diagnostic read access, while all mutations
remain subject to existing admin checks, fresh-session validation, CSRF, and
server-side state validation. Raw paths are less exposed in the default DOM
view but are not newly granted to any role.

## Delivery Security Check

The release check also found outdated production dependencies that were not
introduced by this work. The lockfile now resolves `sharp` 0.35.3, `postcss`
8.5.25, and `body-parser` 2.3.0. The final `npm audit --omit=dev` result is
zero production vulnerabilities. `sharp` 0.35.3 requires Node 20.9 or later;
the supported local and container runtime uses Node 25.

The full development dependency graph still has separate toolchain advisories
for Vite and integration-test dependencies. They do not ship in the runtime
image and should be remediated as a dedicated dependency-maintenance task,
rather than mixed into this behavior change.

## Verification

- Pure client tests cover compact summary wording, quiet/loading states, and
  status-only versus direct-candidate route behavior.
- Browser coverage proves status-only pending-library links open Current
  automation, direct candidate/file links keep it closed, recovery actions
  remain keyboard-focused, read-only evidence remains available, and request
  handoffs continue to target recovery. A 390 CSS-pixel assertion verifies
  that expanded completed-download diagnostics do not horizontally overflow.
- Client lint, test lint, ESM consistency, production build, affected browser
  verification, and a no-cache walkthrough Docker rebuild are release gates.

## Outcome

Match diagnostics now starts with recovery instead of a background-state
dashboard. Operators can inspect selected matches and completed-download
library state when needed, while Music Queue remains the ordinary workflow.

## Next High-Value Item

Replace the Match diagnostics header `visible matches` counter with an
intent-specific recovery summary, and keep result counts entirely inside the
`Find a match` disclosure. That removes the final queue-total language from the
default diagnostics screen.
