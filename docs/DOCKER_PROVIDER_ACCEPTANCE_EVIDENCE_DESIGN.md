# Docker Provider Acceptance Evidence Design

Date: 2026-06-28

## Outcome

The Docker walkthrough now has a replayable provider-acceptance evidence
command:

```powershell
npm run validate:docker-provider-acceptance
```

The validator logs into a running walkthrough instance, reads the authenticated
Downloader queue, Settings, and Import Review execution summary, then verifies
that:

- the download provider is configured and enabled,
- at least one download path mapping exists,
- an Import Review download run has a bounded download acceptance diagnostic,
- the diagnostic is visible in the browser Import Review surface, and
- the emitted JSON evidence contains no provider API key or raw secret value.

The validator supports stricter proof with
`--require-accepted-transfer` when the local slskd run is expected to have
accepted at least one transfer.

## Official Sources Reviewed

- Docker Compose startup order:
  <https://docs.docker.com/compose/how-tos/startup-order/>. Provider evidence
  should run only after the walkthrough stack is healthy.
- Docker Compose service health checks:
  <https://docs.docker.com/reference/compose-file/services/#healthcheck>.
  Health checks are the Compose-native readiness signal for services.
- Docker Compose secrets:
  <https://docs.docker.com/compose/how-tos/use-secrets/>. API keys should stay
  out of committed Compose files and evidence artifacts.
- Docker Compose environment variable best practices:
  <https://docs.docker.com/compose/how-tos/environment-variables/best-practices/>.
  Local environment values are acceptable for disposable walkthroughs, but
  sensitive values should not be logged.
- Playwright locators and assertions:
  <https://playwright.dev/docs/locators> and
  <https://playwright.dev/docs/test-assertions>. The browser proof uses
  user-facing text and headings instead of implementation selectors.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Evidence is bounded to operational status, counts, and path prefixes.
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
  The validator reads authenticated API state without placing secrets in URLs.

## Recommendation

Use Docker-backed browser evidence as the local proof layer, and keep CI on
fixture-backed browser tests.

Pros:

- Captures the real configured walkthrough state without relying on external
  Soulseek peers in CI.
- Proves the operator-visible diagnostic and the durable Import Review read
  model in one run.
- Records path mapping evidence needed to explain why downloads can or cannot
  be imported later.
- Redacts provider secrets by construction.
- Reuses the existing Playwright and Docker smoke evidence conventions.

Cons:

- Requires the operator to configure slskd and create an Import Review download
  run before strict evidence can pass.
- Does not force a remote peer to finish a transfer; it proves provider
  acceptance or bounded rejection.
- Local path mappings remain environment-specific, so evidence is useful for
  replay and troubleshooting but not portable production configuration.

## Final Stack

- Evidence collector:
  `scripts/docker-provider-acceptance-evidence.js`
- CLI wrapper:
  `scripts/validate-docker-provider-acceptance.js`
- Package command:
  `npm run validate:docker-provider-acceptance`
- Shared evidence contract:
  `scripts/docker-smoke-evidence.js`
- Focused tests:
  `test/scripts/docker-provider-acceptance-evidence.test.js`
  `test/scripts/docker-smoke-evidence.test.js`

## Security Notes

- The evidence payload stores whether the slskd secret is configured, not the
  key value or source secret metadata beyond the existing safe status.
- The script does not accept API keys through CLI arguments.
- Evidence includes download-client and Harmoniarr path prefixes because those
  are required for operator troubleshooting. It does not include file contents
  or raw provider API responses.
- The script performs authenticated GET requests after browser login; it does
  not mutate Import Review state.

## Operational Use

Run the command after these prerequisites:

1. Start the walkthrough stack and bootstrap the walkthrough admin.
2. Configure Soulseek in Settings > Connections.
3. Add at least one Settings > Media & storage download path mapping.
4. Select an Import Review candidate and start a download run.
5. Sync transfer state once.

Then run:

```powershell
$env:HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_PATH = ".tmp\docker-provider-acceptance\provider-acceptance.json"
$env:HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_SCREENSHOT_DIR = ".tmp\docker-provider-acceptance\screenshots"
$env:HARMONIARR_WALKTHROUGH_USERNAME = "walkthrough-admin"
$env:HARMONIARR_WALKTHROUGH_PASSWORD = "HarmoniarrLocal123!"
npm run validate:docker-provider-acceptance
```

For a stricter acceptance proof:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer
```

Use the non-strict diagnostic mode only when intentionally capturing a
provider-rejected or blocked run for troubleshooting.

## Follow-Up

The next high-value item is **Import execution selected-candidate readiness
guidance**: when a wanted request produces candidates but no download run is
ready, show the operator the exact missing step from Wanted, Import Review, and
Downloader instead of requiring them to infer it from separate screens.
