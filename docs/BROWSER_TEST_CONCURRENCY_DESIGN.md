# Browser Test Two-Worker Concurrency — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

Harmoniarr's browser suite already has a deterministic completion boundary and
strong test-file isolation. Its next performance improvement must not weaken
the conditions that protect multi-user behavior: each test file starts an
isolated application runtime, PostgreSQL container, temporary database,
browser, browser context, and page.

This design evaluates a deliberately small increase from one to two Node test
worker processes. It makes two workers the normal browser-suite setting only
after representative multi-user coverage, the complete suite, and post-run
resource cleanup prove safe. The production application, Compose services, and
user-facing routes are unchanged.

## Evidence and constraints

Node's process-level test isolation runs each test file in a child process;
`--test-concurrency` limits how many of those processes run at once. The
current browser runtime gives every scenario a non-persistent Playwright
browser context, then closes the context and browser in `finally`. Each test
file's integration runtime owns one PostgreSQL Testcontainer and creates
temporary databases inside it.

The controlled two-worker probe covered Missing Music decisions, manual match
selection, download preparation, Downloader handoff, requester requests,
request actions, and non-admin Import Review access. It passed 10 tests across
6 suites in 28.7 seconds. A complete direct two-worker run passed 89 tests
across 63 suites in 284.3 seconds. Twenty-five seconds after each run,
Testcontainers and Node browser-test process queries returned no resources.

The prior serial complete-suite evidence was 89 tests across 63 suites in
534.6 seconds. The observed reduction is 250.3 seconds (46.8%).

## Options considered

| Option | Advantages | Risks | Decision |
| --- | --- | --- | --- |
| Keep one worker | Lowest resource demand | Retains an avoidable 4.2-minute wall-time cost | Rejected |
| Use two fixed workers | Material measured improvement; resource demand remains bounded and observable | Requires isolated data, random host ports, and cleanup verification | **Adopted** |
| Use all available CPUs | May be faster on a powerful host | Capacity varies by host and can overcommit Docker, Chromium, or PostgreSQL | Rejected |
| Reuse a browser, context, or database across files | Reduces setup cost | Couples user/session/data state and risks authorization leakage or order-dependent tests | Rejected |
| Change the production app or Compose topology | None for a test-only runtime concern | Broadens risk without contributing isolation evidence | Out of scope |

## Decision

Introduce a small ESM browser-test runner with these invariants:

1. Default to exactly two Node test workers.
2. Retain Node's `--test-force-exit` only for the browser suite, after all
   known tests and hooks complete.
3. Preserve process-level test isolation and each file's runtime/container
   lifecycle.
4. Accept only a single `--concurrency=<positive integer>` override. This
   avoids ambient, host-dependent behavior and rejects ambiguous invocation.
5. Provide `npm run test:browser:serial` as the explicit conservative fallback
   for constrained machines or isolation investigation.

The `test:browser` command prepares the client and Chromium, then delegates to
the ESM runner. The runner inherits child output and returns a failing exit
status without suppressing the Node test runner's report.

## Security and multi-user model

Two workers are safe only because worker boundaries remain real boundaries:

- browser contexts remain non-persistent and are never reused between
  scenarios, preventing cookies, local storage, and authenticated session
  state from crossing files;
- temporary PostgreSQL databases and containers remain owned by their test
  files, keeping requests, decisions, audit events, and authorization state
  independent; and
- Testcontainers maps exposed container ports to available random host ports,
  avoiding fixed-port collisions under controlled parallel execution.

No user identity, provider credential, filesystem path, transfer ID, or access
control decision is moved into a process argument, browser URL, or shared test
fixture by this change. The authoritative authorization checks remain on the
server and continue to run in browser coverage.

## W3C accessibility evaluation model

This is test infrastructure, not a visual change. The two-worker setting keeps
current browser checks for semantic headings, named controls, keyboard focus,
dialogs, status feedback, and requester/operator boundaries practical to run.
Following W3C guidance, those automated checks support rather than replace
knowledgeable human evaluation. The pilot uses a representative selection of
the release-decision and request flows before validating the full suite.

## Validation and rollback criteria

Adopt the two-worker default only when all of the following are true:

1. Focused multi-user browser scenarios pass concurrently.
2. The complete browser suite passes with no skips, failures, or retries added
   to conceal a race.
3. No Testcontainers containers or browser-test Node processes remain after a
   post-run cleanup interval.
4. Script unit tests, ESM verification, lint, and full repository validation
   pass.

Any data collision, authorization regression, leaked resource, or flaky result
means using `npm run test:browser:serial` while investigating; the default must
not be raised above two without a new capacity and isolation assessment.

## Recommendation stack

1. **Two fixed workers:** adopt the measured, bounded default.
2. **Keep real isolation:** retain per-file containers and per-scenario browser
   contexts; do not trade it for setup-time savings.
3. **Keep a serial escape hatch:** use it for constrained hosts and race
   diagnosis.
4. **Evaluate accessibly:** retain semantic/keyboard browser coverage and
   human accessibility review.
5. **Require fresh evidence before scaling:** reassess CPU, Docker memory,
   PostgreSQL, and cleanup behavior before considering more workers.

## Sources checked 2026-08-28

- [Node.js test runner execution model](https://nodejs.org/download/release/latest-jod/docs/api/test.html)
- [Playwright parallelism](https://playwright.dev/docs/test-parallel)
- [Playwright browser contexts](https://playwright.dev/docs/browser-contexts)
- [Testcontainers for Node.js: containers and mapped ports](https://node.testcontainers.org/features/containers/)
- [W3C WAI: evaluating web accessibility](https://www.w3.org/WAI/test-evaluate/)
- [W3C WAI: selecting accessibility evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)
- [W3C WCAG-EM: representative sampling and reporting](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
