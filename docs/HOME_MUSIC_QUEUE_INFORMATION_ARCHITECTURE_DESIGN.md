# Home and Music Queue Information Architecture

Status: Implemented and validated
Date: 2026-08-23
Owner: Client experience + quality engineering

## Design Finding

Home displayed a full Music Queue progress card even though Music Queue is a
first-class navigation destination with the complete release list, filtering,
actions, provider-repair guidance, and release detail. This duplicated an
actionable workspace on the Home page, constrained the monitored-artists
workspace, and caused Home to load and poll queue data that the page does not
own.

For a home-hosted application, the clearer boundary is simple:

- Home summarizes the monitored artist collection, release coverage, and
  discovery entry point.
- Music Queue owns release acquisition status, recovery guidance, filtering,
  queue actions, and its provider-dependent data request.

Home now contains no Music Queue section, provider-repair notice, queue
composable, queue polling, or queue refresh. Its Refresh action revalidates
only monitored artists. The monitored-artists card now occupies the complete
Home workspace, directly beneath the artist-level summary; its hierarchy is
policy, release coverage, and reconciliation state. The dedicated navigation
link and Music Queue page are unchanged.

## Official Source Review (accessed 2026-08-23)

- W3C's [Landmark Regions guidance](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
  describes `main` as the primary page content and `nav` as the groups of
  links used to move between page content. Keeping one operational workflow in
  its named navigation destination makes the primary Home content more
  coherent for visual and assistive-technology navigation.
- W3C's [menu structure guidance](https://www.w3.org/WAI/tutorials/menus/structure/)
  recommends stable wording, order, and destinations for visible navigation
  items. The existing Music Queue navigation link remains that stable,
  dedicated destination; Home does not become a competing release-workflow
  view.
- Playwright's [testing best practices](https://playwright.dev/docs/best-practices)
  recommend user-visible assertions and controlled third-party dependencies.
  The regression observes the real local route transition while intercepting
  only the local queue API response; it asserts Home makes no queue request
  and Music Queue makes exactly one.

## Options and Trade-offs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the full queue card on Home | Immediate view of queue rows | Duplicates action scope, consumes the monitored-artist workspace, and adds Home polling | Reject |
| Keep a compact queue count or alert on Home | Retains a cross-page signal | Still makes Home responsible for queue data and creates two places to interpret the same workflow | Reject |
| Move only the release rows but retain provider-repair guidance | Reduces visual density | Splits queue recovery between two pages | Reject |
| Keep Home as monitored-artist summary and use Music Queue for all acquisition work | One clear workflow owner, full Home width for artists, no Home queue request or poll | Users navigate once to inspect or act on queue work | Implement |

## Final Recommendation Stack

1. Keep Home focused on monitored artists, coverage, desired/acquired release
   summary, and Discover entry points.
2. Keep the Music Queue navigation item as the single destination for queue
   rows, states, actions, provider repair, and recovery context.
3. Ensure Home does not instantiate `useMusicQueue` or request the acquisition
   release endpoint.
4. Keep the focused browser regression alongside existing Home and Music Queue
   tests so a future dashboard addition cannot silently reintroduce duplicate
   queue work.

## Security and Data Boundaries

- No endpoint, permission, role, browser-storage policy, or queue action
  changed. Music Queue retains its existing authenticated session and
  CSRF-protected mutation boundaries.
- Home no longer fetches release-level acquisition data as part of its normal
  visit or refresh, reducing unnecessary client-visible operational data and
  background polling.
- The browser test uses an isolated synthetic administrator, a local
  deterministic response, and no saved browser authentication state, provider
  credential, or real release data.

## Open Pull Request Review

The three open Dependabot PRs do not apply to this UI boundary change:

| PR | Finding | Decision |
| --- | --- | --- |
| #40 | Moves the controlled-provider Node image from Node 24.19.0 LTS to Node 26.7.0 Current | Do not apply; runtime policy remains Node 24 LTS |
| #24 | Proposes `docker/build-push-action` 7.2 | Do not apply; `main` already pins 7.3 |
| #23 | Proposes `docker/metadata-action` 6.1 | Do not apply; `main` already pins 6.2 |

No open PR was merged or copied locally.

## Outcome

- Removed the Home queue card, provider-repair notice, queue composable, and
  queue polling. The page now has one direct, full-width monitored-artists
  workspace that retains its responsive artwork grid, controls, keyboard
  roving, loading state, and Discover entry point.
- Added an isolated browser helper for intentionally leaving first-run setup
  mode. The new browser regression verifies that Home makes no acquisition
  release request and that the Music Queue destination makes the request when
  the operator navigates there.
- `node --test --test-concurrency=1 test/browser/operator-ui-smoke.test.js`
  passed all three scenarios, including the new boundary assertion and the
  seeded monitored-artist workflow.
- `npm run validate` passed, including copyright, migration and schema checks,
  ESM and Compose policy checks, lint, test hygiene, server/client/script and
  integration suites, and production client/server builds.
