# Wanted Import Review Selection Handoff Browser Verification Design

Date: 2026-06-28

## Outcome

Added browser verification for the high-confidence candidate selection handoff:

1. Activity > Wanted shows a wanted release with `Ready for selection`.
2. The row explains that the best score meets the threshold and requires Import
   Review selection before download handoff.
3. `Open candidates` routes into Import Review with the matching
   `sourceSearchId` filter.
4. The operator selects the high-confidence candidate.
5. Returning through in-app navigation to Activity > Wanted updates the row to
   `Selected for download`.

This proves the gap seen in local walkthroughs: a successful search can produce
candidates while Downloader remains idle until Import Review selection occurs.

## Official Sources Reviewed

- Playwright locators:
  <https://playwright.dev/docs/locators>. The scenario uses role and text
  locators for user-visible controls instead of implementation-only selectors.
- Playwright auto-waiting and actionability:
  <https://playwright.dev/docs/actionability>. The scenario relies on locator
  click/wait behavior rather than fixed sleeps.
- Playwright isolation:
  <https://playwright.dev/docs/browser-contexts>. The browser runtime provides a
  fresh context and fixture state for the scenario.
- OWASP ASVS:
  <https://owasp.org/www-project-application-security-verification-standard/>.
  The browser proof does not add client-side authorization decisions; it verifies
  the existing server-backed transition surface.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Fixture assertions avoid raw provider payloads, API keys, and sensitive
  details.

## Recommendation

Use fixture-backed browser verification for cross-screen handoffs where unit
tests can prove each piece but not the operator workflow.

Pros:

- Proves the real route, table, link, Import Review action, and return-state
  presentation together.
- Uses deterministic fixture data and avoids slskd or network dependency.
- Catches browser-only issues such as ambiguous locators and reload-driven state
  reset.
- Keeps the production implementation unchanged.

Cons:

- Browser tests are slower than unit tests.
- Fixture state must model the relevant API contract accurately.
- The scenario proves selection handoff, not the later download execution run.

## Final Stack

- Browser spec:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`
- Shared fixture:
  `testing/browser/wanted-browser-fixtures.js`
- Existing Import Review fixture state:
  `testing/browser/metadata-browser-fixtures.js`

## Security Notes

- The browser fixture only returns bounded candidate status/score summaries.
- The transition uses the existing CSRF-backed Import Review action path.
- The test does not assert raw provider payloads, API keys, full slskd response
  bodies, or sensitive local paths as part of the handoff proof.

## Follow-Up

Import Review selected-candidate download execution handoff browser verification
is complete; see
[IMPORT_REVIEW_SELECTED_DOWNLOAD_EXECUTION_HANDOFF_BROWSER_VERIFICATION_DESIGN.md](IMPORT_REVIEW_SELECTED_DOWNLOAD_EXECUTION_HANDOFF_BROWSER_VERIFICATION_DESIGN.md).

The live transfer acceptance proof is complete for the Wanted-origin flow; see
[WANTED_STARTED_DOWNLOAD_TRANSFER_HANDOFF_BROWSER_VERIFICATION_DESIGN.md](WANTED_STARTED_DOWNLOAD_TRANSFER_HANDOFF_BROWSER_VERIFICATION_DESIGN.md).
