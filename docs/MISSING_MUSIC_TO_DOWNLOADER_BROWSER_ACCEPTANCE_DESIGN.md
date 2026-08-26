# Missing Music to Downloader browser acceptance design

**Status:** Implemented 2026-08-26

## Outcome sought

The previously separate browser checks prove individual page behaviour, but an
operator experiences one release lifecycle. This acceptance scenario proves the
safe, release-scoped happy path without connecting to a real provider:

```text
Missing Music
  -> confirm Start search
  -> direct Music Queue release
  -> automatic selection begins download
  -> release-scoped Downloader transfer
  -> no-live-transfer outcome after the transfer leaves the live queue
```

The test is intentionally a lifecycle proof, not a provider integration test.
It uses the real application server, authenticated browser session, and a
container-backed PostgreSQL test runtime. Music Queue and Downloader provider
responses remain deterministic browser fixtures.

## Research basis

Research was checked against official sources on 2026-08-26.

- [Playwright testing best practices](https://playwright.dev/docs/best-practices)
  recommends testing user-visible behaviour, independent tests, and web-first
  assertions. The scenario has its own admin session and fixtures, and uses
  role/name locators plus retrying waits instead of DOM implementation details
  or time-based sleeps.
- [Playwright locators](https://playwright.dev/docs/locators) recommends
  `getByRole`, labels, and accessible names. The acceptance path locates the
  named search confirmation, the `View download progress` link, and the
  release-scoped empty state through their user-facing semantics.
- [W3C Technique G91 for WCAG 2.4.4](https://www.w3.org/WAI/WCAG22/Techniques/general/G91)
  says link text should describe its destination or purpose. The test protects
  the action-specific `View download progress for Autechre — Amber` name and
  checks that it opens the corresponding release scope.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  says cookie-authenticated state-changing requests need CSRF protection and
  should not use GET. The test observes the existing POST search mutation and
  requires its CSRF header without asserting or logging the token value.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep page-specific browser tests only | Fast and focused | A broken route or data contract between workspaces can still pass all individual tests | Rejected |
| Call a real Soulseek provider from a browser test | Exercises an external service | Requires credentials, can cause real downloads, is nondeterministic, and leaks provider concerns into the acceptance suite | Rejected |
| Add one fully fixture-only client test | Low setup cost | Would not prove authenticated routing, CSRF-bearing request construction, or the actual production build | Rejected |
| Add one isolated Docker/Playwright lifecycle scenario over the real app with bounded provider fixtures | Proves the user journey, session, route scope, and client integration while remaining repeatable and safe | Slower than a unit test and requires a local browser/container runtime | Selected |

## Final recommendation stack

1. **Keep one release identity throughout.** Start with `wanted-amber`, then
   assert that Music Queue and Downloader carry only that durable Harmoniarr
   wanted-release ID.
2. **Exercise the real confirmation and mutation boundary.** Start the search
   through the labelled dialog; capture only method, request body, and whether
   a CSRF header is present. Do not record CSRF token material.
3. **Keep provider state fixture-backed.** Model searching, downloading, and
   removal from the live queue using the existing browser fixture modules. No
   provider key, endpoint, filename-derived route, raw transfer ID, or real
   provider request is used.
4. **Use the route as a privacy boundary.** Music Queue uses a path parameter
   and Downloader uses the sole `wantedReleaseId` query key. Assert the URL
   does not include the fixture's provider user or transfer identifier.
5. **Verify the end state is actionable.** After the bounded queue refresh,
   assert `No live transfer for this Music Queue release` and the descriptive
   return link to Music Queue. Absence from a live transfer queue must not be
   presented as a failed acquisition.
6. **Make stateful test fixtures modular.** Existing Music Queue and
   Downloader browser fixture modules own their scoped mutable read models;
   the acceptance test owns only lifecycle data and assertions.

## Implementation boundary

- Extend `testing/browser/music-queue-browser-fixtures.js` with a guarded
  `setRelease` function for a single scoped release. It refuses identity
  changes, preserving the production rule that a route stays release-scoped.
- Extend `testing/browser/downloader-browser-fixtures.js` with a per-context,
  JSON-cloned `setQueue` function. It can model completion/removal only inside
  the isolated test page and never contacts a provider.
- Add a dedicated ESM browser test that composes the existing Missing Music,
  Music Queue, and Downloader fixtures.
- Do not add API endpoints, database migrations, production polling, provider
  credentials, storage, or transfer commands.

## Validation plan

- Lint the changed test and fixture modules.
- Build the client before browser coverage, because the browser runtime serves
  production assets.
- Run the focused Docker/Playwright lifecycle scenario.
- Run repository-wide validation and the security checks.
- Rebuild and bootstrap the localhost-only walkthrough Compose environment
  according to `LOCAL_DOCKER_WALKTHROUGH.md` after validation succeeds.
