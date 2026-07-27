# Music Queue Transfer Recovery Browser Verification

## Status

Implemented on 2026-07-27.

## Goal

After a terminal download failure, Music Queue should progress from `Trying
another match` to `Downloading` without asking the user to refresh, inspect
matches, or open Activity. The user can open release details for reassurance,
but no action is required while recovery is active.

## Research

- [Playwright best practices](https://playwright.dev/docs/best-practices)
  recommends isolated, user-visible tests with resilient locators. The browser
  check owns its authenticated runtime and asserts visible release outcomes.
- [Playwright network mocking](https://playwright.dev/docs/network) supports
  controlled first-party API responses. The test controls only Music Queue and
  Activity read models; it does not call a live provider.
- [Playwright assertions](https://playwright.dev/docs/test-assertions) describes
  retrying web assertions. The test waits for the automatic visible transition
  instead of adding timing sleeps or clicking Refresh.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimising sensitive event data. Activity remains release-scoped:
  no source usernames, paths, provider payloads, match IDs, or secrets appear.
- [Docker Compose `down`](https://docs.docker.com/reference/cli/docker/compose/down/)
  documents explicit volume removal. The browser proof complements, rather than
  replaces, the controlled Docker service proof that owns and removes its
  temporary project and volumes.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require manual Refresh | Straightforward implementation. | Makes an automatic recovery look stalled. | Rejected. |
| Poll every queue state continuously | Fast eventual UI updates. | Wastes requests for stable, stopped, and completed releases. | Rejected. |
| Poll only automatically advancing release states | Keeps recovery current while bounding background reads. | A stable queue still updates only on focus or manual refresh. | Adopted. |
| Test live peer transfers in the browser | Uses a real provider. | Non-deterministic and unsafe for automated content acquisition. | Rejected. |
| Controlled release-state browser contract plus Docker service proof | Covers visible UX and real worker/reconciliation behavior at the correct layers. | Requires two complementary tests. | Adopted. |

## Implementation

`useMusicQueue` now refreshes every 10 seconds only when at least one release
is searching, checking matches, trying another match, downloading, ready to
add, or being added. It pauses polling for stable or action-required releases.

`test/browser/music-queue-transfer-recovery-browser-verification.test.js`
uses controlled first-party read models to prove:

1. a failed transfer is presented as `Trying another match`;
2. release details clearly state that no user action is needed;
3. the visible state becomes `Downloading` through background revalidation,
   without a `Refresh` click;
4. the normal row exposes only `Open Downloader` after recovery; and
5. Activity gives a release-scoped Music Queue handoff without candidate or
   diagnostics navigation.

The existing controlled-provider Docker test separately proves durable
failure, fallback selection, transfer reconciliation, inspection, and safe
library add against PostgreSQL and worker code.

## Security

- The browser fixture contains synthetic release state only.
- Provider credentials, usernames, filesystem paths, match identifiers, and
  raw errors remain absent from Music Queue and Activity assertions.
- The UI polling change is read-only and does not dispatch, retry, or mutate
  provider work from the browser.
- Server-side recovery remains the authority for candidate eligibility and
  scoped fallback selection.

## Validation

```text
node --test test/client/use-music-queue.test.js
node --test test/browser/music-queue-transfer-recovery-browser-verification.test.js
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

## Next Step

The next high-value slice is a compact Music Queue progress surface on Home:
show only releases actively moving or needing help, with one direct handoff to
the release detail. It should reuse the same active-progress classification and
avoid turning Home into an Activity dashboard.
