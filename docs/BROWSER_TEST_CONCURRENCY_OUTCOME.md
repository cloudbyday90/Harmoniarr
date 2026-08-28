# Browser Test Two-Worker Concurrency — Outcome

**Status:** Implemented and validated
**Date:** 2026-08-28

## Delivered result

`npm run test:browser` now runs its isolated browser test files with two fixed
Node workers. It preserves the browser-only deterministic completion boundary,
per-file Testcontainers lifecycle, temporary PostgreSQL databases, and
per-scenario non-persistent browser contexts.

The ESM implementation is split into a testable command builder in
`scripts/browser-test-runner.js` and a thin direct entrypoint in
`scripts/run-browser-tests.js`. It accepts a strict optional concurrency value
and provides `npm run test:browser:serial` as the documented one-worker
fallback. Neither the production app nor its Compose services change.

## Validation record

- Focused concurrent multi-user probe: **10 tests across 6 suites passed** in
  **28.7 seconds**.
- Full direct two-worker pilot: **89 tests across 63 suites passed** in
  **284.3 seconds**.
- Package-command confirmation: `npm run test:browser` passed **89 tests
  across 63 suites** in **290.4 seconds**.
- Previous serial complete-suite result: **89 tests across 63 suites** in
  **534.6 seconds**. The two-worker run was **46.8% faster**.
- Twenty-five seconds after both concurrent runs, Testcontainers and
  browser-test Node process queries were empty.
- Unit coverage for the ESM runner, script/test linting, and ESM verification
  passed before the final repository-validation gate.
- Full repository validation: `npm run validate` passed, including copyright,
  migration and schema policy, ESM, Compose policy, lint, hygiene, server,
  client, script, integration, and production-build gates.

## Open PR assessment

GitHub CLI listing could not authenticate because its credential returned
`HTTP 401`. Locally reachable PR refs were inspected without merging:

- PR #24 is stale: `main` already contains a newer
  `docker/build-push-action` version.
- PR #40 upgrades a controlled-provider fixture to Node 26, which conflicts
  with Harmoniarr's intentional Node 24 engine policy.
- PR #41's dependency revisions are already present on `main`.

No open PR was safe and applicable to apply locally.

## Related design

See [Browser Test Two-Worker Concurrency Design](BROWSER_TEST_CONCURRENCY_DESIGN.md).
