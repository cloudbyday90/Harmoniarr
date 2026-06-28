# Import Review Selected Download Execution Handoff Browser Verification Design

Date: 2026-06-28

## Outcome

Added browser verification that the high-confidence Wanted handoff can continue
into the Import Review download execution runway:

1. Activity > Wanted shows a high-confidence release as `Ready for selection`.
2. `Open candidates` routes to Import Review with the matching `sourceSearchId`.
3. The operator selects the high-confidence candidate.
4. The selected candidate summary reports one candidate ready for download.
5. `Start download run` queues `execution-run-1`.
6. The execution runway shows the queued pending run and persists the
   `execution-start` fixture action.
7. Activity > Wanted shows a selected-candidate `Start the download run`
   guidance block before Downloader activity is expected.

This proves the next visible step after selection: Downloader can remain empty
until the operator starts the download execution run, and Import Review now shows
that queued handoff state.

## Official Sources Reviewed

- Playwright locators:
  <https://playwright.dev/docs/locators>. The browser proof uses role/text
  locators and scopes duplicate text to the selected panel region.
- Playwright actionability and auto-waiting:
  <https://playwright.dev/docs/actionability>. The scenario relies on Playwright
  actionability checks and retrying waits rather than fixed timeouts.
- Playwright browser contexts:
  <https://playwright.dev/docs/browser-contexts>. The test runs in an isolated
  browser context with deterministic fixture state.
- OWASP ASVS:
  <https://owasp.org/www-project-application-security-verification-standard/>.
  The scenario verifies existing server-backed transition surfaces and does not
  introduce client-side authorization decisions.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Fixture assertions stay bounded to status, score, and run ids rather than raw
  provider payloads or secrets.

## Recommendation

Keep the selected-candidate-to-download-run proof in the same browser spec as
the Wanted selection handoff.

Pros:

- Reuses the exact operator journey that starts at Wanted.
- Proves the selected summary and execution runway together.
- Avoids adding production code solely for testability.
- Catches selector ambiguity in the real rendered execution panel.

Cons:

- The scenario is slower than a unit test.
- It proves queueing the execution run, not live slskd transfer acceptance.
- The fixture models the operation-run response; a real slskd-backed smoke test
  is still needed for provider transfer execution.

## Final Stack

- Browser spec:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`
- Shared Wanted/Import Review fixture:
  `testing/browser/wanted-browser-fixtures.js`
- Existing Import Review run fixture:
  `testing/browser/metadata-browser-fixtures.js`

## Security Notes

- The test uses the existing CSRF-backed Import Review run start path.
- No raw provider response, API key, full file list, or secret is asserted.
- The browser fixture persists only bounded candidate, summary, and run state.

## Follow-Up

Download execution live transfer acceptance browser verification is complete for
the Wanted-origin flow; see
[WANTED_STARTED_DOWNLOAD_TRANSFER_HANDOFF_BROWSER_VERIFICATION_DESIGN.md](WANTED_STARTED_DOWNLOAD_TRANSFER_HANDOFF_BROWSER_VERIFICATION_DESIGN.md).

Selected-candidate readiness guidance is complete; see
[IMPORT_EXECUTION_SELECTED_CANDIDATE_READINESS_GUIDANCE_DESIGN.md](IMPORT_EXECUTION_SELECTED_CANDIDATE_READINESS_GUIDANCE_DESIGN.md).

The next high-value follow-up is Import Review selected-run progress refresh
visibility, so operators can stay on the execution panel and see accepted,
blocked, failed, or completed transfer evidence without manual navigation.
