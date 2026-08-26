# Controlled Provider Validation Security Outcome

## Result

Implemented on 2026-08-26. The disposable controlled-provider validation now
keeps its key out of service environment variables and produces bounded,
redacted failure output.

## Delivered

- Split the large verifier gate into
  `scripts/controlled-provider-pipeline-evidence.js`, a focused ESM policy
  module with named aggregate checks.
- Added `scripts/controlled-provider-validation-secret.js`, which writes the
  one-time provider key with mode 0600 inside the disposable workspace.
- Changed the controlled-provider Compose overlay and both fixture processes to
  use `/run/secrets/controlled_provider_api_key`.
- Added `scripts/docker-validation-redaction.js` and reused it in both the
  controlled-provider pipeline and managed slskd smoke validation.
- Made controlled-provider teardown deterministic: it preserves the primary
  validation result, collects redacted logs before teardown, then attempts
  Compose and filesystem cleanup.
- Added focused tests for the aggregate evidence contract, secret file,
  Compose secret wiring, and diagnostics redaction.

## Outcome

### Pros

- A failed verification now says which stable proof is incomplete instead of
  dumping every synthetic ID and nested payload.
- The disposable provider key is explicitly granted only to its two consumers.
- The same log-redaction policy protects two Docker validation paths and avoids
  another large validation singleton.
- The existing user-facing Music Queue and Downloader status model is
  untouched, preserving its W3C-aligned accessible controls and status
  announcements.

### Cons

- Debug output intentionally contains less raw fixture detail; reproducing a
  failing scenario locally is the appropriate way to inspect internal state.
- File-backed Compose secrets add one small temporary-file lifecycle to the
  validation runner.

## Open Pull Request Assessment

No open pull request was applied locally:

- [PR #40](https://github.com/cloudbyday90/Harmoniarr/pull/40) upgrades the
  controlled-provider image to Node 26.7.0, while the repository's current
  supported runtime policy is Node 24 (`.nvmrc` and package engine range).
- [PR #24](https://github.com/cloudbyday90/Harmoniarr/pull/24) proposes
  `docker/build-push-action` 7.2.0, while `main` already pins 7.3.0.
- [PR #23](https://github.com/cloudbyday90/Harmoniarr/pull/23) proposes
  `docker/metadata-action` 6.1.0, while `main` already pins 6.2.0.

Applying any of them would either violate the supported runtime policy or
downgrade the current workflow pin, so none was suitable for local testing.

## Validation Record

The following focused checks passed before the broader validation run:

```text
node --test test/scripts/controlled-provider-pipeline-evidence.test.js \
  test/scripts/controlled-provider-validation-secret.test.js \
  test/scripts/docker-validation-redaction.test.js \
  test/scripts/controlled-provider-compose-contract.test.js \
  test/scripts/docker-controlled-provider-pipeline-validation.test.js \
  test/scripts/managed-slskd-smoke-validation.test.js
npm run lint:scripts
npm run lint:test
npm run check:esm
```

The following broader checks also passed on 2026-08-26:

```text
node scripts/validate-docker-controlled-provider-pipeline.js --no-cache
npm run test:scripts
npm run validate:security
npm run validate
```

The no-cache Docker proof completed all 17 synthetic fixtures and 20 ingested
candidates, including recovery, strict-quality, shared-release, and scoped
Downloader linkage scenarios. `npm run validate:security` reported zero npm
audit vulnerabilities; the full validation gate passed its server, client,
script, and integration suites, ESM/Compose/schema checks, and production
build.

## Final Recommendation Stack

1. Keep the controlled-provider command as the automated credential-free
   Music Queue-to-Downloader proof.
2. Keep real owner-provider checks opt-in, strict, and aggregate-only.
3. Use file-backed Compose secrets for disposable validation credentials and
   the shared redaction module for any future Docker diagnostic output.
4. Only add or alter an operator-visible surface after a real strict probe
   identifies an observed recovery problem.

## Next Item

Run the strict owner-provider probe after an operator has configured slskd,
added the required path mapping, and accepted a Music Queue-origin transfer.
If it reports a concrete readiness code, improve that existing screen rather
than adding a combined Music Queue/Downloader workspace.
