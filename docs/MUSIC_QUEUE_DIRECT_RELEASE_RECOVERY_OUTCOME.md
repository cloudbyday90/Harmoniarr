# Music Queue Direct-Release Recovery Outcome

Status: Implemented 2026-08-23

## Delivered Change

Music Queue now retains its working list when a direct release URL cannot
resolve immediately:

- A slow detail request stays in the selected inspector and uses the existing
  polite loading status without disrupting focus.
- A known unavailable release keeps the queue visible and offers `Return to
  Music Queue`.
- A temporary detail failure keeps the queue visible and offers `Try again`
  plus `Return to Music Queue`.
- Recovery copy is generic; raw provider, network, and server error text is
  not displayed.
- A direct URL focuses the resolved release heading or recovery heading once,
  then uses the queue heading when it is closed.

The implementation is split between a small pure ESM recovery-presentation
module and the existing Music Queue view and review-panel boundaries. No
CommonJS module, persistent retry worker, or external service was added.

## Open Pull Request Review

Pull request #41 was fetched to the local `codex/pr-41-local` branch and
reviewed without merging or applying it. Its dependency bump is stale relative
to `main`: the current lockfile already resolves newer Vue language-server,
ESLint, and Globals packages, while applying the pull request would also move
unrelated lockfile entries backward, including Vite. It is not safe or useful
to apply locally, so this change leaves it untouched.

## Validation Evidence

- Client and test linting pass.
- Focused client tests cover unavailable, retryable, and empty recovery
  presentation mapping, including the guarantee that raw error text is not
  rendered.
- The focused browser scenario covers direct-link loading, unavailable, and
  retry paths; it verifies the queue remains usable, recovery labels and
  actions are present, generic failure text is used, and programmatic focus
  has a visible outline.
- The full client build and repository test suite are run before commit.

## Next Recommended Item

Harden the existing Close-focus fallback for a filtered or refreshed queue:
if the row action that opened the inspector disappears before Close, the focus
helper should retry the queue heading instead of stopping after it sees the
now-disconnected row action. This completes the focus-origin contract already
documented for a changing local queue.
