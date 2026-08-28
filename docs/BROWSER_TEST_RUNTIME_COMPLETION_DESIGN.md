# Browser Test Runtime Completion — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

The native browser suite runs each browser test file in an isolated Node test
child process. Its browser, browser context, HTTP server, application pool,
temporary PostgreSQL database, and test container all close in explicit
`finally` or suite teardown paths. Despite that completed cleanup, the Node
child can retain an idle event-loop handle for roughly one extra minute.

The browser suite contained 76 modules when this work began, so that idle wait
obscured failures and made comprehensive accessibility and interaction
verification impractical. The companion canonical-coverage retirement removes
13 modules that tested a route which now redirects, leaving 63 current browser
suites.
This change gives the browser command a deterministic process-completion
boundary without sharing browser state, relaxing database isolation, or
changing application behavior.

## Measured baseline

The same built, isolated Missing Music worklist browser scenario was run with
the default command and with Node's test force-exit option:

| Command mode | Test result | Elapsed wall time |
| --- | --- | ---: |
| Default `node --test --test-concurrency=1` | 1 pass | 73.5 seconds |
| `node --test --test-force-exit --test-concurrency=1` | 1 pass | 7.9 seconds |

The scenario itself completed in about 4.5–4.8 seconds in both runs. After the
force-exit run, `docker ps -a --filter label=org.testcontainers` reported no
remaining test container. This establishes that the long tail is not required
for the visible test, its database cleanup, or its browser/context cleanup.

## Current lifecycle and constraints

`testing/browser/playwright-smoke-runtime.js` creates a new Chromium browser,
non-persistent `BrowserContext`, and page for each scenario. Its `finally`
block closes the context and browser. The integration runtime then closes the
server and connection pool, drops the temporary database, and stops its
per-file PostgreSQL container during suite teardown.

These boundaries protect multi-user and security-sensitive browser coverage:

- Cookies, local storage, and sessions must not leak between browser scenarios.
- A temporary PostgreSQL database remains isolated per scenario; tests must not
  share user, request, decision, provider, or audit records.
- Browser tests continue to exercise server-side authorization, fresh-session,
  and CSRF behavior rather than replacing it with browser-only fixtures.
- Application code, production Compose behavior, and production resource
  lifecycles are out of scope.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the default Node completion behavior | No script change | Adds roughly a minute of idle time per browser file | Rejected |
| Add `--test-force-exit` to `test:browser` | Removes the proven idle tail after Node has completed known tests and teardown hooks; preserves current isolation | Does not diagnose the third-party/runtime idle handle; requires strong cleanup coverage | **Adopted** |
| Run browser files concurrently | Could shorten wall time further | Risks Docker, CPU, port, and temporary-database contention; needs dedicated isolation/load evidence | Deferred |
| Reuse one browser/context or one database for many files | Reduces setup cost | Weakens clean-slate session and data isolation, creating order-dependent and multi-user security risk | Rejected |
| Rebuild the suite on another test runner | Could gain fixture orchestration | High migration cost with no evidence it removes the handle; risks coverage regressions | Rejected |

## Decision

Add Node's `--test-force-exit` to the repository-wide `test:browser` command,
after its existing build and browser-install steps. Keep
`--test-concurrency=1`, process-level file isolation, the per-scenario browser
context, and temporary PostgreSQL database lifecycle unchanged.

The option applies only after Node has finished all known tests and their
hooks. It does not turn off test failures, shorten scenario timeouts, bypass
browser/context closure, or modify production code. The existing focused
Artist Detail cache browser proof already uses the same explicit completion
boundary, so this makes the general browser command consistent with an
established project practice.

## W3C and accessibility model

This is test-infrastructure work, not a visual or semantic UI change. It keeps
the existing accessible role/name, keyboard, focus-visible, responsive, and
live-region browser checks executable in a practical feedback loop. Automated
checks assist accessibility evaluation but cannot replace human judgment, so
the change neither claims WCAG conformance nor removes manual accessibility
review.

## Recommendation stack

1. **Deterministic completion:** use Node's supported force-exit boundary for
   the browser-only command after test/hook completion.
2. **Keep clean-slate isolation:** retain per-scenario browser contexts and
   temporary databases.
3. **Keep serial execution for now:** only consider parallel browser workers
   after explicit Docker, database, and resource-budget measurements.
4. **Preserve human accessibility review:** retain browser accessibility
   assertions and manual review alongside automated coverage.
5. **Measure regressions:** record elapsed time for a representative browser
   command and verify no Testcontainers resources remain after it exits.

## Sources checked 2026-08-28

- [Node.js test runner](https://nodejs.org/download/release/latest-jod/docs/api/test.html)
- [Playwright test isolation](https://playwright.dev/docs/browser-contexts)
- [Playwright Browser lifecycle](https://playwright.dev/docs/api/class-browser)
- [Playwright parallelism and external shared state](https://playwright.dev/docs/test-parallel)
- [W3C: Selecting accessibility evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)
