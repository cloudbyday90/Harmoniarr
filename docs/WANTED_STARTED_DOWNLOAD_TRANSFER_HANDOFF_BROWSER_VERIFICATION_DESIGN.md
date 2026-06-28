# Wanted-Started Download Transfer Handoff Browser Verification Design

Date: 2026-06-27

## Outcome

Added browser verification for the full Wanted-origin download handoff:

1. Activity > Wanted exposes a high-confidence release as `Ready for selection`.
2. The operator opens the matching Import Review candidates.
3. The operator selects the high-confidence candidate.
4. The operator starts the download execution run.
5. The browser fixture syncs the execution run into a live accepted Downloader
   transfer.
6. The execution runway shows an active transfer and exposes `Open in
   Downloader`.
7. Downloader opens directly to the linked transfer detail drawer with Import
   Review linkage evidence.

This closes the browser-level gap between candidate selection and live Downloader
visibility. The test remains deterministic by simulating provider acceptance in
the browser fixture after the real Import Review execution start action.

## Official Sources Reviewed

- Playwright locators:
  <https://playwright.dev/docs/locators>. The scenario uses role and text
  locators, with scoped locators for repeated execution-run text.
- Playwright actionability and auto-waiting:
  <https://playwright.dev/docs/actionability>. The flow relies on Playwright's
  retrying locator waits and actionability checks instead of fixed sleeps.
- Playwright browser contexts:
  <https://playwright.dev/docs/browser-contexts>. The proof runs in an isolated
  browser context with per-scenario fixture state.
- OWASP ASVS:
  <https://owasp.org/www-project-application-security-verification-standard/>.
  The test continues to exercise the existing authenticated Import Review and
  Downloader surfaces without introducing client-side authorization shortcuts.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Assertions stay bounded to run ids, candidate ids, transfer ids, and status
  messages; no API keys or raw provider secrets are captured.

## Recommendation

Keep the Wanted-started transfer proof as a browser fixture scenario rather than
requiring a real slskd transfer in the default test suite.

Pros:

- Proves the exact operator journey from Wanted to Downloader.
- Keeps CI deterministic and independent of Soulseek network availability.
- Exercises the production UI routing and detail-drawer behavior.
- Models transfer acceptance through the Import Review reconciliation endpoint
  rather than directly mutating rendered state.

Cons:

- It does not prove that a live slskd instance accepts a real download.
- The fixture must stay aligned with the provider-backed execution read model.
- Real path mapping and remote-peer availability still need local/Docker
  acceptance evidence.

## Final Stack

- Browser spec:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`
- Wanted transfer fixture:
  `testing/browser/wanted-download-transfer-browser-fixtures.js`
- Wanted fixture:
  `testing/browser/wanted-browser-fixtures.js`
- Import Review reconciliation fixture:
  `testing/browser/metadata-browser-fixtures.js`
- Downloader queue fixture:
  `testing/browser/downloader-browser-fixtures.js`

## Security Notes

- The run still starts through the CSRF-backed Import Review execution endpoint.
- The transfer sync is queued through a test-only fixture helper and consumed by
  the existing reconciliation endpoint.
- The Downloader detail route is validated by transfer id and source username,
  not by raw provider payloads or credentials.

## Follow-Up

The next high-value item is **provider-backed download acceptance diagnostics**:
use the local Docker walkthrough with configured slskd and download path mapping
to prove a real selected candidate either creates a transfer or reports a
specific actionable block, such as no acceptable remote files, path mapping
failure, provider rejection, or stale queue state.
