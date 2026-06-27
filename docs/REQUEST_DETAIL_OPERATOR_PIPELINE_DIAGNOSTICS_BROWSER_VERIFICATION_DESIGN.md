# Request Detail Operator Pipeline Diagnostics Browser Verification

## Status

Implemented in June 2026.

## Problem

Requester Request Detail now proves that pipeline status, journey stages, and
events stay aligned while requester payloads remain least-privilege. The paired
operator/admin surface needed proof that the richer projection remains useful:

- source-user and folder context are visible,
- run status messages and errors are visible,
- operation run and import-candidate IDs are available for diagnostics,
- the import-review drill-through link is keyboard reachable,
- and the requester-safe projection remains a separate boundary.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions: https://playwright.dev/docs/test-assertions
- Playwright actionability: https://playwright.dev/docs/actionability
- MDN `<details>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
- WCAG 2.2 focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep requester and operator projections distinct | Prevents accidental diagnostic leakage while preserving operator utility | Requires browser coverage for both sides |
| Prefer native `details`/`summary` for candidate diagnostics | Built-in keyboard behavior and disclosure semantics | Requires careful locator scoping because summary/body text can overlap |
| Surface run diagnostics only when projected fields exist | Requester payloads stay clean without extra role checks in most markup | Operator detail display depends on correct server projection |
| Use role-first browser assertions for lists and links | Verifies actual user-facing navigation and focus behavior | Some diagnostic fields need text/structure scoped assertions |

## Final Recommendation Stack

- Use the existing Request Detail pipeline section rather than introducing a new
  diagnostics page.
- Add small pure presentation helpers for operator source labels, folder paths,
  run IDs, candidate IDs, and status messages.
- Render operator diagnostics only from fields present in the role-projected
  candidate payload.
- Verify the admin flow through browser automation: create request, seed raw
  candidate diagnostics, open Request Detail, expand the candidate, and activate
  `Open in import review` by keyboard.

## Implementation Outcome

- `formatCandidateSourceLabel` can now prefer operator source context when the
  projected candidate includes `username` and `folderPath`.
- Added operator diagnostics helpers in `request-pipeline-presentation.js`:
  `formatCandidateFolderPath`, `hasRunDiagnostics`, `formatRunId`,
  `formatImportCandidateId`, and `formatRunStatusMessage`.
- Request Detail now displays:
  - source folder,
  - download/import status messages,
  - operation run IDs,
  - import-candidate IDs,
  - run error diagnostics,
  - and the existing import-review drill-through link.
- Added
  `test/browser/request-detail-operator-pipeline-diagnostics-browser-verification.test.js`.

## Security Notes

This slice intentionally makes diagnostics visible only when the pipeline
projection includes operator fields. Requester tests still seed raw private
candidate data and prove the requester view does not expose peer names, private
paths, candidate IDs, run IDs, status messages, or import-review links.

## Next High-Value Item

Verify failed-import recovery handoff from Request Detail to Import Review. The
operator diagnostic link is now visible and keyboard-usable; the next adjacent
risk is whether the target review workspace selects the candidate, surfaces the
same failure context, and exposes the correct retry/reopen controls.
