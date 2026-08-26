# Missing Music decision workspace outcome

**Completed:** 2026-08-26

## Delivered

- Replaced the oversized action slot in `MissingView.vue` with the small,
  reusable ESM-backed `MissingReleaseDecisionActions.vue` component.
- Added **Open Music Queue** as both a visible button and the accessible
  artwork-card action. The route is scoped to the release's durable
  wanted-release ID, so the operator lands on the relevant Music Queue
  release, not an unfiltered list.
- Retained **Start search** as the only acquisition-triggering action. Its
  confirmation now describes a Music Queue search rather than a generic media
  request, and it no longer presents an unrelated `Request for` selector.
- After a confirmed successful search, navigated directly to that release in
  Music Queue so the operator can see automatic progress or make a match
  choice without hunting for the row.
- Kept **Keep selected manually** separate from searching. Its existing
  confirmation continues to say it queues reconciliation and does not start a
  search.
- Made the shared confirmation dialog describe its concise explanation to
  assistive technology and focus **Cancel** on open, then updated the browser
  regression expectation accordingly.

## Security and integrity outcome

The release route carries only a Harmoniarr wanted-release ID and performs no
write. Music Queue remains responsible for server-scoped release reads and
all subsequent match, quality, library, and Downloader operations.

The only state-changing action remains the existing POST search request. It
continues to use the application's CSRF token and server-side
`media.request` permission check. This work deliberately adds no direct
Missing-to-Downloader route, no new queue mutation, no browser-stored state,
and no provider implementation detail.

## Accessibility outcome

The visible labels and accessible names use the same action-first terms:

| Visible action | Accessible name pattern | Result |
| --- | --- | --- |
| Start search | `Start a search for Artist — Release` | Clearly initiates the search stage. |
| Open Music Queue | `Open Music Queue for Artist — Release` | Clearly opens the release decision workspace. |
| Keep selected manually | `Keep Release selected manually` | Clearly records desired-state intent without implying acquisition. |

The card's support text explains the lifecycle before interaction, rather than
requiring a person to infer what `Request` means. The modal uses a labelled
native dialog, exposes its short explanation with `aria-describedby`, keeps
focus within the dialog, and puts initial focus on the cancellation action.

## Validation evidence

- `npm run lint:client` and `npm run lint:test` passed.
- `node --test test/client/missing-release-decision-presentation.test.js test/client/wanted-release-normalization.test.js` passed.
- `npm run build:client` passed.
- `node --test --test-concurrency=1 test/browser/missing-card-grid-keyboard-roving.test.js` passed all three scenarios, including dialog focus, no recipient selector in the search confirmation, and the direct release route.
- `npm run validate` passed, covering copyright, migration/schema policy, ESM consistency, lint, test hygiene, server/client/script/integration suites, and production client/server builds.
- `npm run validate:security` passed; the image/topology policy checks passed and npm audit reported zero vulnerabilities.

## Next recommended item

Validate the full cross-workspace happy path in Docker/Playwright: selected
release in Missing Music → confirmed search → direct Music Queue release →
manual or automatic candidate selection → release-scoped Downloader progress.
The test should use only fixtures and existing provider adapters, assert no
provider identifiers appear in the browser route, and capture the no-live-
transfer state after completion.
