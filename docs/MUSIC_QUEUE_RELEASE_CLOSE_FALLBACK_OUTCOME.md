# Music Queue Release Close-Fallback Outcome

Status: Implemented 2026-08-23

## Delivered Change

Music Queue now resolves an ordered set of Close-focus candidates after Vue
removes the selected release inspector:

1. The row action that opened the inspector, when it remains connected.
2. The visible queue-section heading, when filtering or refresh removed that
   row but the queue workspace remains.
3. The persistent Music Queue page heading, when a refresh removes every row
   and the queue-section heading unmounts with the empty state.

The pure ESM focus controller owns the ordered candidate policy. The Vue
composable owns post-render DOM resolution and attempts candidates in order.
The view only supplies its two stable heading references. This preserves the
route as the selected-release source of truth and does not turn the inspector
into a modal or introduce new route, persistence, or server concerns.

## Open Pull Request Review

Pull request #41 was fetched to `codex/pr-41-local` and evaluated locally,
without merging or applying it. It proposes older development-dependency
versions than the versions currently resolved by `main`; applying its stale
lockfile would also move unrelated entries backwards. The current repository
already resolves Vue language server and TypeScript plugin 3.3.11, ESLint
10.9.0, Globals 17.11.0, and Vite 8.2.2. The pull request was therefore not
applicable to this work and was left untouched.

## Validation Evidence

- Client and test linting pass.
- Focused controller and composable tests cover row, direct, duplicate, and
  disconnected-candidate behavior.
- Browser coverage verifies Close after a filter removes the opening row and
  after Refresh removes every row, including visible focus outlines.
- The full Music Queue browser suite, repository test suite, production build,
  and ESM consistency check pass before commit.

## Next Recommended Item

Define an explicit keyboard-focus contract for Music Queue mutations that
replace selected-detail content, such as choosing a match or retrying a
recovery action. The contract should retain focus on the invoked action while
it remains available, then move once to the updated outcome heading only when
the action itself is removed. That keeps action feedback and changed release
state discoverable without adding noisy focus jumps.
