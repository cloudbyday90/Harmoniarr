# Music Queue Release Focus-Origin Outcome

Status: Implemented 2026-08-23

## Delivered Change

Music Queue now keeps keyboard focus meaningful across its conditional release
inspector:

- Opening a release from its row leaves focus on that action.
- Closing that inspector returns focus to the same action after the inspector
  unmounts.
- Opening a direct release URL focuses the ready inspector heading once.
- Closing a direct release URL focuses the Music Queue list heading.
- Inspector and list fallback headings have visible, token-based focus
  outlines.

The implementation uses the ESM-only
`music-queue-release-focus-controller.js` module plus the
`useMusicQueueReleaseFocus.js` composable. The controller is deliberately
small and route-aware; it does not turn Music Queue into a modal dialog.

## Decision Outcome

The adopted approach keeps the benefits of the conditional inspector—full
queue width when unselected, route-addressable release detail, and list/detail
comparison—without making keyboard users recover from a lost focus location.
It uses a row action only when it was the actual origin. A direct URL instead
uses the queue heading as its truthful post-Close destination.

## Open Pull Request Review

The available GitHub CLI credentials could not be used to query pull-request
metadata, so pull refs were enumerated safely from `origin` and reviewed
locally without merging or changing their branches.

| Pull request | Local review result | Outcome |
| --- | --- | --- |
| #38 | Changes a historical fixture from Node 25.4 to Node 26.5. Node 26 is Current, not LTS, until October 2026; main already uses the Node 24.19 LTS policy. | Not applicable; do not apply. |
| #37 | Updates development dependencies, but its pinned values would downgrade versions already present on main (including Vite, ESLint, Globals, and the Vue language server). | Not applicable; do not apply. |

No open PR was applied because neither one was safe or relevant to this
change. The application worktree remains based on main and contains only the
reviewed focus-origin implementation.

## Validation Evidence

- `npm run lint:client` passed.
- `npm run lint:test` passed.
- The six focused controller/composable unit tests passed.
- `npm run build:client` passed.
- The focused Playwright browser scenario passed. It verifies row-origin Close
  restoration, direct-route heading focus, direct-route Close fallback, and
  visible focus outlines for both programmatic heading targets.
- `npm test` passed, including repository lint, test hygiene, server, client,
  script, and serial integration suites.
- `npm run build` passed for both the production client and server bundles.
- The local walkthrough Compose rebuild was attempted exactly as documented but
  is blocked by Docker Desktop DNS: it cannot resolve `auth.docker.io` while
  fetching the Dockerfile frontend token. No application image was built or
  started, so the walkthrough bootstrap step was intentionally not run.

## Next Recommended Item

After focus-origin behavior is verified, test the direct Music Queue route
under a slow or failed release-detail response and make its unavailable state
an explicit, keyboard-visible recovery path. That is the remaining edge of
the selected-release lifecycle; it should preserve the same route authority
and non-modal workspace model.
