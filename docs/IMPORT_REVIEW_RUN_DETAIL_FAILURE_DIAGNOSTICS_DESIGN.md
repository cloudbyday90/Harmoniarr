# Import Review Run-Detail Failure Diagnostics Browser Verification

## Context

Batch AU made selected Import Review runway runs linkable through query state.
The next risk was the content behind those links: operators usually open a
historical run because something failed, stalled, or needs review. A durable run
detail URL must therefore show the failure cause and diagnostic evidence without
requiring a separate server-log lookup.

## Official Sources Reviewed

- [Playwright locators](https://playwright.dev/docs/locators): role and text
  locators should match how users and assistive technology perceive the page,
  while scoped/filtering locators avoid brittle DOM-position assertions.
- [Playwright best practices](https://playwright.dev/docs/best-practices):
  browser tests should verify user-visible behavior and isolate state through
  controlled fixtures.
- [MDN ARIA `status` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role):
  `status` is appropriate for advisory information that should be announced
  politely without interrupting the user.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  client route state must not substitute for server-side authorization checks.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html):
  state transitions and privileged workflow decisions should be validated in the
  server-side business layer.

## Recommendations

1. Treat run-detail URLs as read intent only. They can select a run, but API
   role checks remain the security boundary.
2. Keep transient request/action failures as assertive `role="alert"` messages.
   Durable historical run failures should be polite `role="status"` diagnostics.
3. Verify diagnostics through visible operator copy rather than fixture internals:
   run ID, current step, failure message, degraded transfer notice, item status,
   persisted transfer observation, and apply file-operation messages.
4. Reuse a shared failure notice component across media inspection, download,
   and import apply panels to keep semantics consistent.
5. Keep media-inspection diagnostics aggregate-only for this slice because the
   current server read model does not persist per-file inspection warnings.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Browser-test existing run-detail payloads | Low risk, proves current operator-critical UI | Media inspection remains aggregate-only |
| Add shared failure notice component | Consistent semantics and styling across panels | New component dependency in three panels |
| Use `role="status"` for historical failures | Accessible without over-announcing stale failures | Less urgent than `alert` if a live failure appears while focused |
| Extend media inspection to per-file persistence now | More complete diagnostics | Requires schema/store/worker changes beyond browser verification scope |

## Final Stack

- `ImportCandidateRunFailureNotice.vue` for durable selected-run failure text.
- Existing media inspection, execution, and apply runway panels for diagnostics.
- Existing run-detail query parameters from Batch AU.
- Production-shaped browser fixtures with failed historical run payloads.
- Playwright browser verification using role/text locators scoped to each panel.

## Implementation Outcome

- Added `ImportCandidateRunFailureNotice.vue`, a small shared component that
  renders durable run failure messages as polite status content.
- Wired the shared failure notice into:
  - `ImportCandidateMediaInspectionPanel.vue`
  - `ImportCandidateExecutionPanel.vue`
  - `ImportCandidateApplyPanel.vue`
- Added browser coverage for direct failed historical run links across all three
  runway panels.
- Verified media inspection aggregate diagnostics: selected failed run,
  current step, run error, unavailable count label, and blocked-candidate label.
- Verified execution diagnostics: run error, degraded transfer notice,
  queue-failed item status, transfer disappearance message, transfer exception,
  and persisted transfer observation.
- Verified apply diagnostics: run error, apply-failed item status, failed file
  operation, specific filesystem failure message, and not-attempted operation.

## Security Notes

The implementation does not grant access from client route state. It only
renders data returned by existing Import Review run-detail endpoints. Requester
and non-admin access remains covered by earlier Import Review read-only browser
verification; future server-side expansion for media inspection detail must
preserve the same role checks.

## Known Gap

Media inspection currently stores aggregate warning/unavailable counts on the
operation run summary. It does not persist per-candidate or per-file inspection
warning details, so the UI cannot yet show the exact file that failed probing.

## Validation

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-run-detail-failure-diagnostics-browser-verification.test.js`

## Next High-Value Item

Media-inspection per-file diagnostic persistence and browser verification. The
next useful improvement is a schema/store/worker slice that records per-candidate
and per-file inspection warnings for a media inspection run, then renders those
details in the selected-run panel.
