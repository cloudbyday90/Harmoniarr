# Provider-Backed Download Acceptance Diagnostics Design

Date: 2026-06-28

## Outcome

Import execution now persists and renders a bounded download acceptance
diagnostic for each execution item. The diagnostic explains whether a selected
candidate:

- was blocked before provider enqueue,
- had no unlocked downloadable files,
- was accepted by the download provider,
- was accepted with file-level rejections, or
- was rejected entirely by the download provider.

The diagnostic is stored under the existing execution item snapshot at
`planningSnapshot.execution.diagnostics.downloadAcceptance`, so no schema change
or parallel job system was required. Import Review renders the diagnostic in the
download execution panel, alongside existing run and transfer state.

## Official Sources Reviewed

- Docker Compose startup order:
  <https://docs.docker.com/compose/how-tos/startup-order/>. Provider-backed
  acceptance evidence should run only after dependent services are healthy.
- Docker Compose healthcheck reference:
  <https://docs.docker.com/reference/compose-file/services/#healthcheck>.
  Health checks are the Compose-native readiness signal for local provider
  validation.
- Docker Compose secrets:
  <https://docs.docker.com/compose/how-tos/use-secrets/>. Provider API keys and
  webhook secrets must stay out of committed files and diagnostic payloads.
- Docker Compose environment variable best practices:
  <https://docs.docker.com/compose/how-tos/environment-variables/best-practices/>.
  Environment files are acceptable for local walkthroughs, but sensitive values
  should be handled carefully and not logged.
- Playwright locators:
  <https://playwright.dev/docs/locators>. Browser verification continues to use
  role and text locators scoped to the visible operator panel.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Diagnostics are bounded to counts, ids, and operator-safe messages.
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
  Client-visible diagnostics avoid stack traces, credentials, and low-level
  provider internals.

## Recommendation

Keep provider-backed acceptance diagnostics inside the Import Review execution
read model.

Pros:

- Uses the durable operation item that already explains execution outcome.
- Gives the operator an actionable reason when Downloader stays empty.
- Keeps provider secrets and raw API responses out of UI and logs.
- Avoids a new diagnostic route or a second execution model.
- Works for both CI fixture proof and local Docker walkthrough validation.

Cons:

- It summarizes provider acceptance; it does not replace live slskd transfer
  reconciliation.
- File-level provider rejection details are limited to normalized filenames.
- Real remote peer behavior still requires local provider validation because CI
  cannot depend on Soulseek network availability.

## Final Stack

- Diagnostic builder:
  `src/server/import-candidates/import-candidate-execution-diagnostics.js`
- Execution worker integration:
  `src/server/import-candidates/import-candidate-execution-worker.js`
- Operator UI:
  `src/client/components/ImportCandidateExecutionPanel.vue`
- Server tests:
  `test/server/import-candidate-execution-diagnostics.test.js`
  `test/server/import-candidate-execution-worker.test.js`
- Browser proof:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`

## Security Notes

- Diagnostics do not include API keys, bearer tokens, raw provider payloads, or
  stack traces.
- The UI renders bounded titles, messages, counts, and operator actions.
- The execution run still starts through the CSRF-backed Import Review mutation
  path and existing operation-run worker.
- Provider acceptance state remains operator-only through the existing Import
  Review admin surface.

## Follow-Up

Docker walkthrough provider acceptance evidence is now implemented in
`docs/DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_DESIGN.md` through
`npm run validate:docker-provider-acceptance`.

The next high-value item is **Import execution selected-candidate readiness
guidance**: when a wanted request produces candidates but no download run is
ready, show the operator the exact missing step from Wanted, Import Review, and
Downloader instead of requiring them to infer it from separate screens.
