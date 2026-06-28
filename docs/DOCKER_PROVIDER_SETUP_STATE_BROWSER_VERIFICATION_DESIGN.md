# Docker Provider Setup-State Browser Verification Design

Status: Implemented
Date: 2026-06-27

## Scope

This document covers the follow-up to provider prerequisite gating: prove the
packaged Docker walkthrough stays quiet and actionable when Soulseek through
slskd has not been configured.

The verification targets the default local walkthrough state:

- no topbar operator alert noise for expected missing slskd setup
- Discovery dispatch reports a setup hint instead of a failed heartbeat
- Downloader exposes a static disabled-provider empty state
- Downloader does not repeatedly poll a provider-backed queue when slskd is
  unconfigured

## Official Sources Reviewed

- Playwright actionability and auto-waiting:
  https://playwright.dev/docs/actionability
- Playwright locator guidance:
  https://playwright.dev/docs/locators
- Docker Compose `up` CLI reference, including `--wait`:
  https://docs.docker.com/reference/cli/docker/compose/up/
- Docker Compose build reference:
  https://docs.docker.com/reference/cli/docker/compose/build/
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Error Handling Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

## Findings

- Browser smoke verification should assert user-visible state with Playwright
  locators and normal actionability waits instead of fixed sleeps, except for
  the specific no-poll observation window.
- Docker walkthrough validation should remain on the existing
  `validate:docker-browser-smoke` path so the same evidence contract covers
  local exploration and release browser evidence.
- Missing provider setup is not an application failure. The expected state is a
  setup-required heartbeat plus setup copy on the affected surface, not repeated
  operation-run failures or unread topbar alerts.
- The verification must wait for the first Discovery dispatch heartbeat because
  heartbeat runners tick after startup but are not guaranteed to finish before
  the browser logs in.

## Options Considered

### Option A: Add A Separate Docker Provider-State Validator

Pros:

- Narrow command focused only on the provider prerequisite contract.
- Could run against a clean Compose project without affecting the walkthrough.

Cons:

- Creates another Docker validation path to maintain.
- Does not strengthen the existing browser evidence artifact.
- More setup duplication around login, screenshots, and evidence writing.

### Option B: Extend Packaged Runtime Browser Smoke

Pros:

- Reuses the established Docker walkthrough browser evidence path.
- Proves the contract in the same packaged UI surface operators use.
- Keeps screenshots and JSON evidence attached to one smoke run.

Cons:

- Adds several seconds to browser smoke because poll suppression needs an
  observation window.
- Assumes the walkthrough stack is clean enough that historical failures are
  not already present in operator notifications.

### Option C: Unit-Test Only

Pros:

- Fastest validation.
- Good at proving payload normalization and notification filtering.

Cons:

- Does not prove packaged runtime wiring, browser rendering, or polling
  suppression.
- Would not catch the original local walkthrough symptom.

## Final Recommendation Stack

1. Extend `scripts/docker-browser-smoke-validation.js`.
2. Keep pure assertion helpers for fast script tests.
3. After login, poll `/api/v1/system/overview` until Discovery dispatch reports
   `setup_required`.
4. Assert `/api/v1/system/operator-notifications` is empty for the clean
   unconfigured provider state.
5. Assert `/api/v1/downloader/queue` returns a disabled, empty read model.
6. Navigate to `/app/downloader`, verify the setup CTA, and observe one poll
   interval to prove the disabled-provider page does not keep polling the
   provider-backed queue.

## Outcome

Implemented:

- `validate:docker-browser-smoke` now records
  `provider_setup_state_verified` and `downloader_setup_state_loaded`
  checkpoints.
- The browser smoke asserts the operator notification payload is empty on a
  clean unconfigured-provider walkthrough stack.
- The browser smoke waits for Discovery dispatch to become `setup_required`
  with slskd setup guidance.
- The browser smoke verifies the Downloader setup empty state and confirms only
  one queue read occurs during the disabled-provider observation window.
- Focused script tests cover the pure payload contract and timeout propagation.

Follow-up:

- Rebuild and reset the Docker walkthrough stack before using this smoke as
  release evidence, otherwise historical failures from older local runs can
  correctly fail the clean-state notification assertion.
- Next high-value item: add route-level setup responses for manual
  slskd-backed actions so user-initiated discovery/search paths get the same
  calm setup copy instead of provider errors.
