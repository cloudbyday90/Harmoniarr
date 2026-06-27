# Import Review Diagnostic Repair Retry-Success Verification Design

Status: Implemented

## Context

Diagnostic repair now has independent browser proof for both successful repair
and failed repair. The remaining operator-risk path is the handoff between
those states: after a failed diagnostic `Reopen`, the same retry action should
succeed without leaving stale alert copy, dropping the focused diagnostic file,
or losing the selected media-inspection run.

## Official Guidance Reviewed

As of June 2026:

- Playwright recommends user-facing role/text locators:
  <https://playwright.dev/docs/locators>
- Playwright best practices recommend testing observable user behavior and
  keeping tests isolated: <https://playwright.dev/docs/best-practices>
- Vue Router supports route object navigation with explicit `query` and `hash`
  state: <https://router.vuejs.org/guide/essentials/navigation.html>
- MDN documents `HTMLElement.focus()` for programmatic focus recovery:
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus>
- MDN documents `Element.scrollIntoView()` for preserving visible file context:
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView>
- OWASP authorization guidance recommends server-side, deny-by-default
  authorization: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Keep retry handling inside the existing Import Review transition flow. The
second `Reopen` should reuse the same server-authorized endpoint after the
one-shot fixture failure is consumed. On retry success, the UI should clear the
prior alert, move focus to the success `role="status"` message, show the
candidate's `Pending` action state, and preserve the diagnostic route context.

Do not introduce a diagnostic-only retry state machine. The current queue
composable already clears `actionError` before each transition attempt and sets
`actionStatus` only after a successful server response; the browser contract
should lock in that behavior.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Verify failure-to-success in one browser scenario | Covers the exact operator retry flow; catches stale alert and route-loss regressions | Adds one focused browser scenario |
| Rely on separate success and failure tests | Lower test count | Does not prove state handoff after a real failed attempt |
| Add a new retry-only client state model | Could make retry state explicit | Duplicates existing transition state and risks stale client authority |
| Preserve existing transition flow | Smallest secure surface; keeps server response authoritative | Requires precise assertions around alert clearing and status focus |

## Final Stack

- **Mutation path:** existing `reopen` transition endpoint remains the only
  repair authority.
- **Error-to-success handoff:** `useImportReviewQueue` clears `actionError` and
  `actionStatus` before each transition, then sets success status only after the
  successful retry response.
- **Focus contract:** failure keeps focus on `Reopen`; retry success moves focus
  to the `role="status"` success message.
- **Route contract:** `candidate`, `candidateFile`, and `mediaInspectionRunId`
  survive the failure and the successful retry.
- **Browser verification:** `test/browser/import-review-diagnostic-repair-retry-success-browser-verification.test.js`
  drives the full failed-then-successful diagnostic repair flow.

## Outcome

- A failed diagnostic repair can be retried from the same `Reopen` action.
- Successful retry clears the prior alert and focuses the success status.
- The candidate transitions to `Pending` and exposes the expected `Hold` and
  `Select` actions.
- The diagnostic file highlight and selected media-inspection run remain
  intact across both mutation attempts.

## Follow-Up

The next high-value item is Import Review direct diagnostic route reload
verification: load `/app/activity/candidates` directly with `candidate`,
`candidateFile`, and `mediaInspectionRunId` query state and prove the selected
run detail plus focused file row hydrate correctly without first clicking a
diagnostic table row.
