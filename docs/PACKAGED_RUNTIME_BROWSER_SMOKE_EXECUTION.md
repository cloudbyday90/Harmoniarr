# Packaged-Runtime Browser-Smoke Execution

Status: Implemented

## Context

The Docker deployment-path evidence already proved API-level fresh install,
released-image, and baseline-upgrade behavior. The remaining release-evidence
gap was browser proof that the packaged runtime serves the operator UI and
preserves the critical first-run, settings, activity, import-review, and
recovery navigation path.

This run executed browser smoke locally on June 27, 2026 against the packaged
Docker walkthrough stack at `http://127.0.0.1:47956`.

## Official Guidance Reviewed

As of June 2026:

- Playwright best practices recommend user-visible locators and avoiding
  implementation details for stable browser tests:
  <https://playwright.dev/docs/best-practices>
- Playwright locators document role, label, and text locators as the preferred
  resilient selection model:
  <https://playwright.dev/docs/locators>
- Playwright actionability and auto-waiting remove the need for fixed sleeps:
  <https://playwright.dev/docs/actionability>
- Docker Compose documents disposable stack lifecycle commands:
  <https://docs.docker.com/compose/>
- GitHub Actions artifact documentation supports preserving generated evidence
  outside the repository:
  <https://docs.github.com/actions/using-workflows/storing-workflow-data-as-artifacts>
- OWASP Docker Security Cheat Sheet recommends least privilege, controlled
  secrets, and minimal runtime permissions:
  <https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html>

## Recommendation

Keep the packaged-runtime browser smoke narrow and deterministic:

1. Start the packaged Docker walkthrough stack from the candidate image.
2. Bootstrap the disposable walkthrough admin through the existing helper.
3. Run `npm run validate:docker-browser-smoke` with JSON evidence enabled.
4. Enable checkpoint screenshots only for release evidence or local debugging.
5. Verify the JSON evidence with `npm run validate:docker-smoke-evidence`.
6. Archive JSON and screenshots as release artifacts, not committed source.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Focused browser smoke | Fast release signal for login, navigation, Import Review, and recovery UI | Does not replace full browser suite |
| Screenshot checkpoints | Human-reviewable release evidence and easier diagnosis | More artifacts to retain and prune |
| Role/label-first locators | Tracks user-visible UI and accessibility semantics | Requires copy changes to be intentional |
| CSS/test-id locators | Lower coupling to copy | Can miss real accessibility or navigation regressions |

## Final Recommendation Stack

- Browser automation: Playwright Chromium through native ESM scripts.
- Locator policy: role, label, heading, and visible text locators first.
- Waiting policy: Playwright auto-waiting and URL waits; no fixed sleeps.
- Runtime: packaged Docker walkthrough stack on localhost-only binding.
- Evidence: machine-readable JSON plus optional checkpoint screenshots.
- Security: disposable walkthrough credentials only, local bind mounts, no
  generated secrets committed to source.

## Implementation Notes

`scripts/docker-browser-smoke-validation.js` now records optional checkpoint
screenshots when `screenshotDir` is provided. The validation result includes the
paths alongside the existing checkpoint list.

The login checkpoint now waits for the visible account-menu button containing
the username instead of the removed `.session-username` implementation class.
The Activity and Import Review checkpoints were also updated to current
user-facing headings: `Activity`, `Background Jobs`, and `Match diagnostics`.

`scripts/validate-docker-browser-smoke.js` accepts:

- `--password-file`
- `--screenshot-dir`
- `HARMONIARR_WALKTHROUGH_PASSWORD_FILE`
- `HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR`

`scripts/release-evidence-pack.js` passes the same screenshot directory through
when browser smoke is enabled, defaulting to `browser-smoke-screenshots` inside
the release evidence directory.

For a browser smoke included in a release-evidence pack, use either
`--browser-password-file` or `HARMONIARR_WALKTHROUGH_PASSWORD_FILE`. Configure
one password source only: the file input is preferred, while the existing
direct password option and environment variable remain available for a
disposable local walkthrough.

The release-image workflow now also sets
`HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR`, uploads
`harmoniarr-docker-smoke-browser-screenshots`, and reports that artifact in the
published-image verification summary.

## Execution

Command:

```powershell
$env:HARMONIARR_DOCKER_BROWSER_SMOKE_EVIDENCE_PATH = ".tmp\docker-browser-smoke-evidence\harmoniarr-docker-smoke-browser-operator.json"
$env:HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR = ".tmp\docker-browser-smoke-evidence\screenshots"
$env:HARMONIARR_WALKTHROUGH_USERNAME = "walkthrough-admin"
$env:HARMONIARR_WALKTHROUGH_PASSWORD_FILE = "C:\secrets\harmoniarr-walkthrough-password"
$env:HARMONIARR_DOCKER_BROWSER_SMOKE_TIMEOUT_MS = "30000"
npm run validate:docker-browser-smoke
```

The password file must contain only the password, with an optional final
newline. Keep it outside the repository and do not use `docker/walkthrough.env`
as the password file: it contains `KEY=value` entries. The command reads the
password only into its transient browser context and does not include the
secret or file path in terminal output or evidence.

Evidence generated:

- `.tmp\docker-browser-smoke-evidence\harmoniarr-docker-smoke-browser-operator.json`
- `.tmp\docker-browser-smoke-evidence\screenshots\01-login-page-loaded.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\02-login-completed.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\03-settings-loaded.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\04-operations-loaded.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\05-candidates-loaded.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\06-recovery-loaded.png`
- `.tmp\docker-browser-smoke-evidence\screenshots\07-backup-preview-ready.png`

Evidence verification:

```powershell
$env:HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH = ".tmp\docker-browser-smoke-evidence\harmoniarr-docker-smoke-browser-operator.json"
npm run validate:docker-smoke-evidence
```

## Outcome

Passed checkpoints:

- `login_page_loaded`
- `login_completed`
- `settings_loaded`
- `operations_loaded`
- `candidates_loaded`
- `recovery_loaded`
- `backup_preview_ready`

The first execution attempt exposed stale selectors in the browser smoke
scenario. Updating the scenario to user-facing headings and visible account
menu semantics fixed the packaged-runtime smoke without adding app-only test
hooks.

## Follow-Up

The next high-value item is final registry-authenticated release replay:
repeat the Docker deployment-path and browser-smoke evidence run with
registry-accessible immutable digest refs, then archive the deployment summary,
smoke JSON, and screenshot artifacts together.
