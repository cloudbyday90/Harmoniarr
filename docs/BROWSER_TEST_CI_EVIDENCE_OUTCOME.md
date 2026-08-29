# Browser Test CI Evidence — Outcome

**Status:** Implemented and validated
**Date:** 2026-08-28

## Delivered result

The browser-suite runner can now emit bounded, machine-readable CI evidence
when `HARMONIARR_BROWSER_TEST_EVIDENCE_PATH` is configured. It measures the
Node browser-test child, waits for Testcontainers and browser-test Node
processes to exit, writes a schema-validated JSON file below the repository
working directory, and fails a passing test run if cleanup is not clean.

The new `Browser Validation` GitHub Actions workflow runs the existing
two-worker suite with Chromium system dependencies, writes a compact job
summary, and retains the JSON artifact for 14 days. It is read-only and uses
commit-SHA-pinned actions.

## Evidence contract

The artifact records the result, worker count, child-run duration, cleanup
result, resource counts, attempt count, maximum wait, timestamp, and schema
version. It does not retain identifiers, process command lines, logs, paths,
URLs, user information, request details, or secrets.

## Validation record

- Focused evidence, runner, and workflow-contract coverage passed: **16 tests**.
- `npm run test:scripts` passed: **284 tests**.
- `npm run lint:scripts`, `npm run lint:test`, and `npm run check:esm` passed.
- A complete local `npm run test:browser` run with evidence enabled passed at
  two workers. The child runtime was **296.6 seconds**.
- The generated evidence reported **8 cleanup checks**, **0 Testcontainers**,
  and **0 browser-test Node processes** remaining with status `clean`.
- The generated job-summary Markdown rendered only the bounded allow-listed
  values.
- `npm run validate` passed, including copyright, migration and schema policy,
  ESM, Compose policy, lint, hygiene, node suites, integration suites, and the
  production build.

## First remote execution

The first remote run reached the browser suite after the CI npm-policy
alignment. Its setup, npm 12 bootstrap, strict `npm ci`, Chromium install,
evidence summary, and evidence-artifact upload completed successfully. The
browser suite exposed an unrelated responsive overflow and two timing-sensitive
UI waits; it therefore did not produce a successful baseline sample. The
targeted correction retains two workers and is documented in
[Browser Validation CI Compatibility Design](BROWSER_VALIDATION_CI_COMPATIBILITY_DESIGN.md).

## Open PR assessment

GitHub CLI access currently returns `HTTP 401`, so authenticated PR discovery
is unavailable. Locally reachable PR refs were checked without merging:

- PR #24 is stale because `main` already uses a newer pinned
  `docker/build-push-action` release.
- PR #40 moves a controlled fixture to Node 26, conflicting with the supported
  Node 24 engine range.
- PR #41's dependency revisions are already present on `main`.

No open PR was safe and applicable to apply locally.

## Next recommended item

Observe the bounded artifact across at least 10 representative CI runs before
considering any concurrency experiment. If timing or cleanup drifts, retain
the two-worker limit and investigate the resource lifecycle first.

## Related design

See [Browser Test CI Evidence Design](BROWSER_TEST_CI_EVIDENCE_DESIGN.md) and
[Browser Test Two-Worker Concurrency Design](BROWSER_TEST_CONCURRENCY_DESIGN.md).
