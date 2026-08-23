# Music Queue Release Mutation-Focus Outcome

Status: Implemented 2026-08-23

## Delivered Change

Music Queue now has an explicit keyboard-focus contract for in-place release
mutations:

1. A keyboard-activated action retains focus when its control remains present.
2. If a render replaces that control with an equivalent action, focus moves to
   the replacement action only when the browser has fallen back to its body.
3. If the action is gone, focus moves once to the visible `Current status`
   heading in the same release inspector.
4. If the operator moved focus while the asynchronous action was running, the
   newer focus is left alone.
5. Action feedback continues to be announced in the existing scoped live
   regions and is never used as a focus target.

The implementation is split by responsibility:

- `music-queue-release-mutation-focus-controller.js` is a pure ESM policy
  module for short-lived mutation tokens.
- `useMusicQueueReleaseMutationFocus.js` owns Vue render timing and DOM focus
  checks.
- The review components emit the native initiating control and expose only the
  current action and outcome-heading lookups needed by the view.
- `MusicQueueView.vue` owns mutation lifecycle orchestration without changing
  routes, APIs, saved state, provider interaction, or background work.

The behavior covers match selection and rejection, search and quality choices,
safe-library-add actions, and retrying release details.

## Open Pull Request Review

Pull request #41 was fetched again into `codex/pr-41-local` and evaluated
locally without merging it. Its dependency updates remain behind the current
resolved development toolchain: Vue language server and TypeScript plugin
3.3.11, ESLint 10.9.0, Globals 17.11.0, and Vite 8.2.2. Applying it would
downgrade already newer lockfile entries, so it remains inapplicable and was
not applied.

## Validation Evidence

- Focused controller and composable tests cover retained controls, replacement
  controls, removed controls, user-moved focus, and mouse-originated actions.
- Browser coverage verifies retained focus for a successful in-place action,
  focus recovery after match selection removes its actions, and focus recovery
  after a retry replaces its recovery action, including visible focus outlines.
- Client/test linting, the full Music Queue browser suite, repository tests,
  production build, and ESM consistency check pass before commit.

## Security Boundary

The change is client-only and keeps DOM references in memory for one mutation
completion. It adds no data persistence or transport and changes no server-side
authorization, CSRF, provider, audit, or background-job behavior.

## Next Recommended Item

Make selected-release mutations single-flight in the Music Queue UI. Today an
active match action marks its own card as busy while another match card can
still be activated, allowing competing decisions before the first response
returns. Disable all decision controls for that selected release during an
active mutation, retain the current action feedback, and add browser coverage
that confirms one deliberate action cannot race another.
