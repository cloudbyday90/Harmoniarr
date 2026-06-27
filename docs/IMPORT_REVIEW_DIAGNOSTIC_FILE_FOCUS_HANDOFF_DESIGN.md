# Import Review Diagnostic File Focus Handoff Design

Status: Implemented

## Context

Batch AX made media-inspection diagnostics actionable by opening the affected
candidate from a selected run. The remaining operator friction was locating the
exact file inside a multi-file candidate after the handoff.

## Official Guidance Reviewed

As of June 2026:

- Vue Router supports programmatic navigation with query and hash state through
  route objects: <https://router.vuejs.org/guide/essentials/navigation.html>
- MDN documents `HTMLElement.focus()` including `preventScroll`, which lets code
  focus after explicit scroll placement:
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus>
- MDN documents `Element.scrollIntoView()` and its alignment options:
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView>
- Playwright recommends role and accessible-name locators for user-visible
  browser verification: <https://playwright.dev/docs/locators>
- OWASP authorization guidance keeps authorization server-side and
  deny-by-default: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Extend the existing route-state handoff with a durable `candidateFile` query
parameter while keeping the public candidate key unchanged:

```text
/app/activity/candidates?candidate=<candidateId>&candidateFile=<fileId>&mediaInspectionRunId=<runId>#import-review-selection-stage
```

`ImportReviewView` should only merge route state and pass the focused file ID
down. `ImportCandidateDetailPanel` should own the DOM work because it renders the
file rows and knows when they exist.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Durable `candidateFile` query + component-owned focus | Shareable/back-button friendly; preserves run context; file focus lives at the rendering boundary | Adds one route-state key |
| Local-only focus state in `ImportReviewView` | Smaller URL surface | Not durable after refresh/back navigation |
| Hash per file row | Simple browser-native anchor behavior | Collides with the panel hash already used for selected-run navigation |
| New file-detail subview | Maximum detail affordance | Too much surface for a focus handoff; would duplicate candidate authorization/action context |

## Final Stack

- **Route state:** `candidateFile` public query key normalized as internal
  `candidateFileId`.
- **Diagnostic action payload:** `ImportCandidateMediaInspectionDiagnostics.vue`
  emits `{ candidateId, fileId }`.
- **View boundary:** `ImportReviewView.vue` merges `{ candidateId,
  candidateFileId }` through the existing admin workflow route replacer and keeps
  the selection-workspace hash.
- **Detail focus:** `ImportCandidateDetailPanel.vue` accepts `focusedFileId`,
  records refs for candidate file rows, scrolls the matching file into view, and
  focuses it with `preventScroll`.
- **Visual affordance:** The focused file row gets a clear accent treatment plus
  a `:focus-visible` outline.
- **Security:** No new API or data disclosure. The client only passes IDs already
  present in the authorized media-inspection diagnostic payload; candidate detail
  and actions remain server-authorized.

## Outcome

- Diagnostic row actions now open the affected candidate and focus the exact
  affected file row.
- Route state preserves `mediaInspectionRunId`, `candidate`, and
  `candidateFile` together.
- Browser coverage asserts the exact focused file row through its
  `data-import-candidate-file-id` and active element state.
- Existing candidate-level handoff behavior remains compatible with older
  string-only event payloads.

## Follow-Up

The next high-value item is diagnostic-driven candidate repair-state
verification: after landing on a focused diagnostic file, verify the operator can
hold, reject, or reopen from that context without losing selected-run and file
focus state unexpectedly.
