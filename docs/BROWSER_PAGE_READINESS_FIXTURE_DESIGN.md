# Browser Page-Readiness Fixture — Design

**Status:** Implemented
**Date:** 2026-08-29

## Purpose and evidence

Browser Validation runs every scenario with an isolated database, Express app,
Chromium context, and a fixed two-worker Node test runner. A normal remote run
nevertheless produced unrelated 30-second waits on Artist Detail and Search,
while the same two tests and one complete local two-worker run passed. This is
evidence of a shared, environment-sensitive page-readiness dependency, not a
reason to raise the action timeout, retry an assertion, or reduce workers.

The app shell always starts its heartbeat after it mounts. Its
`GET /api/v1/system/overview` request performs live dependency health checks,
including MusicBrainz, even when a browser scenario is testing an unrelated
page. Bootstrap also lands on the first-run view, whose
`GET /api/v1/system/onboarding` summary performs the same MusicBrainz health
check. Together, these introduce remote provider availability and
provider-response latency into every page journey.

## Research and decision

Playwright recommends isolated tests and user-facing locators with auto-waiting.
Its routing API supports context-wide request fulfillment before pages are
created, and the most recently registered matching route can override an
earlier fixture. The runtime already blocks service workers, which Playwright
recommends when request interception is used.

WCAG 2.2 requires programmatically determinable names and roles for scripted
interfaces. The browser tests therefore continue to wait for real headings,
labels, links, and status states in the rendered application. The new fixture
does not add test-only DOM attributes or change end-user markup.

## Design

Two small ESM fixture modules own the shared browser-readiness boundary. Before
a scenario creates its first page, the browser runtime installs context routes
for `GET /api/v1/system/overview` and `GET /api/v1/system/onboarding`. They
return only:

- a zero active-job count;
- healthy status for the three shell indicators; and
- an empty, completed first-run checklist; and
- no URLs, provider details, credentials, users, paths, logs, or request data.

The response is `no-store`, matching the server's API-cache boundary. A method
outside the read contract falls through rather than being silently rewritten.
Scenario-specific routes registered later retain precedence, so a test can
still supply a distinct overview state when that state is the subject under
test.

The real endpoint is not removed or weakened. Its authorization and complete
response contract remain covered by server route tests. Browser tests still
exercise the actual client heartbeat code and the actual accessible shell; they
only remove an external, unrelated health probe from page-workflow tests.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Increase the 30-second action timeout | Small code change | Masks a shared fault and slows failure feedback | Rejected |
| Retry failed page assertions | Might hide temporary service delays | Reduces diagnostic value and leaves external dependency in place | Rejected |
| Run browser tests serially | Could reduce contention | Violates the retained two-worker policy and lowers CI coverage efficiency | Rejected |
| Fixture the unrelated readiness endpoints at the context boundary | Keeps two workers and real page semantics while removing live provider I/O | Browser UI tests no longer verify the complete overview or onboarding response | **Adopted** |
| Mock each affected test individually | Narrow setup | Repeats behavior and misses future scenarios | Rejected |

## Security and multi-user boundaries

- The fixture is test-runtime-only; production routes, authorization, and
  multi-user data access are unchanged.
- It cannot expose provider secrets, health-response details, filesystem paths,
  request records, or user data because none are present in the static
  allow-listed payload.
- Tests that need the live route contract remain server-level tests where
  authentication and response behavior are asserted directly.
- The browser context remains isolated per scenario and service workers stay
  blocked, preventing persistent browser state from bypassing interception.

## Recommendation stack

1. **Adopt the context-level overview and onboarding fixtures** for browser
   page-workflow tests.
2. **Keep the 30-second action timeout and two-worker setting unchanged.**
3. **Use semantic role and label locators** to prove the actual accessible UI
   becomes ready.
4. **Keep the full system-overview route contract in server tests** and add a
   scenario-level override only when a browser test is explicitly about its
   presentation.
5. **Collect a new serial Browser Validation sample** after this repair before
   considering any worker-capacity change.

## Official sources checked 2026-08-29

- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Playwright browser-context routing](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright route handler ordering](https://playwright.dev/docs/api/class-route)
- [Playwright parallelism and isolation](https://playwright.dev/docs/test-parallel)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
