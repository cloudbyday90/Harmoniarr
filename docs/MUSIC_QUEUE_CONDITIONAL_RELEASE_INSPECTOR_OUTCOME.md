# Music Queue Conditional Release Inspector Outcome

Status: Implemented 2026-08-23

## Outcome

Music Queue now uses its full available width before a release is selected.
Choosing a release action opens the release inspector beside the list on a
wide viewport and below it on a narrow viewport. Closing it removes the
inspector and restores the full-width list; no generic empty inspector remains.

## Changes

- Added the ESM-only `music-queue-workspace-presentation.js` module to keep
  selected-release layout state out of the view.
- Made the selected inspector conditional in `MusicQueueView.vue` and retained
  the release list during a detail fetch.
- Added a local inspector loading state with a Close action, instead of
  replacing the page with a global loading card.
- Connected the active row action to the mounted inspector with
  `aria-expanded` and `aria-controls`.
- Added unit and browser coverage for the initial full-width list, selection,
  inspector relationship, focus retention, close behavior, and responsive
  layout.

## Security And Data Boundary

The implementation is presentation-only. It does not change release detail
authorization, action authorization, CSRF, fresh-session checks, provider
connectivity, diagnostics visibility, or safe-add rules. Existing safe,
release-scoped server handlers remain the enforcement point.

## Open Pull Request Review

Dependabot PR #40 was applied locally without committing. The overlay rendered
successfully with Compose and the `node:26.7.0-alpine` image is available, but
the change would make the controlled-provider fixture run on Node 26 while
Harmoniarr declares Node `>=24.15.0 <25.0.0` as its supported runtime. It was
therefore excluded; no pull request was merged.

## Validation

- `npm run lint:client` passed.
- `npm run lint:test` passed.
- Focused Music Queue client tests passed.
- `npm run test:client` passed: 4,105 tests.
- `npm run check:esm` passed.
- `npm run check-copyright` passed.
- `npm run build:client` passed.
- `node --test --test-concurrency=1 test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`
  passed: five desktop/mobile Music Queue scenarios, including the conditional
  inspector, retained opening focus, ARIA relationship, close behavior, and
  no mobile horizontal overflow.

## Next Item

Add origin-aware focus behavior for the conditional inspector: return focus to
the row action after Close when the inspector was opened from the list, and
focus the inspector heading after a direct release URL loads. Keep the route
as the selected-release source of truth.
