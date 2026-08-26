# Browser validation secret-input outcome

Status: Implemented

## Delivered outcome

The two packaged-runtime browser-validation entry points now share the same
file-backed secret boundary as provider acceptance:

- `scripts/validate-docker-browser-smoke.js` supports `--password-file` and
  `HARMONIARR_WALKTHROUGH_PASSWORD_FILE`.
- `scripts/release-evidence-pack.js` supports `--browser-password-file` and
  `HARMONIARR_WALKTHROUGH_PASSWORD_FILE` when browser smoke is enabled.
- `scripts/secret-input.js` now offers both optional and required ESM secret
  resolution, so the release-evidence pack can omit browser credentials when
  its optional browser smoke is disabled.

Direct options and environment variables remain supported to avoid breaking an
existing disposable walkthrough. If both direct and file sources are supplied,
the commands stop with a redacted configuration error. If a file cannot be
read or is empty, the error identifies only the environment-variable contract,
not the secret or its path.

## Documentation outcome

- Updated the local Docker walkthrough with the preferred file-backed command.
- Updated packaged-runtime browser-smoke execution guidance with both new CLI
  contracts and password-file handling requirements.
- Added the separate design record in
  `BROWSER_VALIDATION_SECRET_INPUT_DESIGN.md`.

## Validation outcome

Focused script tests cover direct compatibility input, password-file input,
optional absence, redacted failure behavior, browser-smoke input resolution,
and release-evidence browser-smoke resolution. The repository validation and
security checks passed:

- `node --test test/scripts/secret-input.test.js test/scripts/docker-browser-smoke-validation.test.js test/scripts/release-evidence-pack.test.js`
- `npm run lint:scripts`
- `npm run lint:test`
- `npm run check:esm`
- `npm run validate`
- `npm run validate:security` (including `npm audit` with 0 reported
  vulnerabilities)

## Open pull-request review

The open dependency pull requests were reviewed locally but not applied:

- #40 raises the container from Node 24 to Node 26, outside the repository's
  supported runtime policy (`>=24.15.0 <25.0.0`).
- #24 and #23 update Docker GitHub Actions to versions already superseded by
  the current `main` workflow pins.

No open PR was applicable to this change; no PR was merged.

## Next recommended work

The remaining high-value provider-acceptance evidence is an operator-approved
run that intentionally creates and observes a real peer-to-peer transfer in a
controlled local environment. That action is not performed by this change,
because it changes external provider state and should be explicitly initiated
by the operator.
