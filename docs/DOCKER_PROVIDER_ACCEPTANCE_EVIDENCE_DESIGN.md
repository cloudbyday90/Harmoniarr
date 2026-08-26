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
- the emitted JSON evidence contains no provider API key, raw secret value, or
  machine-specific path prefix.

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
  <https://playwright.dev/docs/test-assertions>. The browser proof uses an
  accessible heading and visible diagnostic text; it opens only the known
  native disclosure that contains the advanced diagnostic before asserting it.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Evidence is bounded to operational status and counts.
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
- Records whether path mapping evidence is present without serializing the
  machine-specific mapping itself.
- Redacts provider secrets by construction.
- Reuses the existing Playwright and Docker smoke evidence conventions.

Cons:

- Requires the operator to configure slskd and create an Import Review download
  run before strict evidence can pass.
- Does not force a remote peer to finish a transfer; it proves provider
  acceptance or bounded rejection.
- A mapping count proves only that a mapping is saved; it does not prove a
  particular completed provider path resolves inside the container.

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
- Evidence includes a path-mapping count rather than download-client or
  Harmoniarr path prefixes. It does not include file contents or raw provider
  API responses.
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

To verify only the safe setup prerequisites before starting an Import Review
download run, use readiness-only mode. It requires the configured provider and
download path mapping, but intentionally does not require a diagnostic,
provider-accepted transfer, or Music Queue-linked transfer:

```powershell
npm run validate:docker-provider-acceptance -- -- --readiness-only
```

Readiness-only mode rejects conflicting strict execution flags and attempts to
disable either setup prerequisite. It is a read-only preparation check, not
evidence that a provider accepted a transfer.

For a stricter acceptance proof:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer
```

Use the non-strict diagnostic mode only when intentionally capturing a
provider-rejected or blocked run for troubleshooting.

If a strict prerequisite is missing, the command writes the configured evidence
artifact first, then exits unsuccessfully with one labelled next action. See
[Docker Provider Acceptance Readiness Design](DOCKER_PROVIDER_ACCEPTANCE_READINESS_DESIGN.md).

## Follow-Up

The next high-value item is a strict local Music Queue-to-Downloader proof:
create a Music Queue-origin transfer, then rerun the strict evidence command.
Keep the resulting recovery guidance in the existing Music Queue, Import
Review, and Downloader surfaces; do not add another queue view unless observed
operator friction requires it.
