# Import Review Diagnostic-Driven Repair-State Verification Design

Status: Implemented

## Context

Diagnostic handoff now opens the affected candidate and focuses the exact file
that triggered a media-inspection warning. The next risk was the repair step:
operator actions such as `Reopen` can refresh queue/detail state and rewrite the
route. If that route rewrite drops `mediaInspectionRunId` or `candidateFile`,
the operator loses the selected-run diagnostic context they came from.

## Official Guidance Reviewed

As of June 2026:

- Vue Router supports route object navigation with query and hash state:
  <https://router.vuejs.org/guide/essentials/navigation.html>
- Playwright recommends user-facing locators and resilient web-first assertions:
  <https://playwright.dev/docs/locators>
- Playwright best practices recommend testing user-visible behavior:
  <https://playwright.dev/docs/best-practices>
- MDN documents focus management through `HTMLElement.focus()`:
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus>
- OWASP authorization guidance keeps authorization server-side and
  deny-by-default: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Preserve diagnostic route state during repair transitions, because the focused
file remains valid after a review-state mutation. Clear `candidateFile` only
when the operator intentionally selects a different candidate from the normal
queue or changes filters, because then the file focus no longer belongs to the
active detail context.

Do not add a new repair endpoint or client-only repair state store. The existing
candidate transition endpoints remain the authority, and route state remains the
durable browser state.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Preserve run/file route state during repair transitions | Keeps diagnostic context intact; works with refresh/back navigation; no new API | Requires careful stale-state clearing on normal candidate changes |
| Clear all diagnostic state after every repair action | Simple route logic | Loses the diagnostic file context immediately after repair |
| Store diagnostic focus only in component state | Avoids a query key | Not durable and easy to desynchronize after queue refresh |
| Add a diagnostic-specific repair flow | Highly tailored UX | Duplicates existing candidate transition controls and authorization surface |

## Final Stack

- **Route state:** `useImportReviewWorkspace` preserves current run IDs and
  `candidateFileId` when rebuilding route query state.
- **Stale-state cleanup:** normal queue candidate selection, filter apply, reset,
  and automatic route backfill clear `candidateFileId`.
- **Hash preservation:** workspace query replacements keep the current hash when
  one exists, so query-only updates do not lose the active Import Review anchor.
- **Repair action:** existing candidate transition actions remain unchanged and
  continue to use server-authorized endpoints.
- **Browser verification:** a focused Playwright suite starts from a selected
  media-inspection run, opens a diagnostic file, executes `Reopen`, verifies
  status focus and selected-run/file route preservation, then selects a different
  queue candidate and verifies stale file focus is cleared.

## Outcome

- Repair transitions from a diagnostic file preserve `candidate`,
  `candidateFile`, and `mediaInspectionRunId`.
- Success feedback remains keyboard-focused through the existing status focus
  behavior.
- Selecting a different candidate from the queue clears `candidateFile` while
  preserving the selected run context.
- Added
  `test/browser/import-review-diagnostic-repair-state-browser-verification.test.js`.
- Added a unit guard proving normal queue candidate selection clears stale
  diagnostic file focus while preserving selected-run state.

## Follow-Up

The next high-value item is Import Review diagnostic failure-state verification:
queue a failed repair transition from a focused diagnostic file and verify the
error is retryable, focus returns to the failed action, and diagnostic route
state is not accidentally cleared.
