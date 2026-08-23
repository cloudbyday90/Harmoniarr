# Music Queue Release Mutation Single-Flight Outcome

Status: Implemented 2026-08-23

## Delivered Change

Music Queue now allows one mutation at a time in its selected release
inspector. A match selection, match rejection, search retry, quality choice,
safe-add recheck, or library add claims a small in-memory ESM gate before it
can start an API request. A competing action returns immediately, retains the
active action feedback, and does not overwrite it or issue another request.

During that request:

1. The invoked match action remains focused and exposes `aria-disabled` plus
   the existing working status.
2. Other match actions use native `disabled`, so they cannot be activated or
   add unnecessary keyboard stops.
3. Release-level actions use native `disabled` as well.
4. Completion, handled error, and thrown error paths all release the gate.

The behavior is split between the pure
`music-queue-release-mutation-gate.js` policy module, the existing
`useMusicQueue.js` composable, and the focused review components. All code is
ES Module code; no CommonJS module or server singleton was introduced.

## Validation Evidence

- Focused gate and Music Queue composable tests prove a pending action owns the
  gate, competing same-release actions make no API call, feedback is preserved,
  and the next action is permitted after completion.
- The full Music Queue release-row browser suite proves the active match action
  retains focus and its working description, an alternate match is native
  disabled, and it becomes available again when the request completes.
- Repository linting, test hygiene, the full node test suite, production build,
  and ESM consistency check passed.
- The local walkthrough Compose image was rebuilt using
  `docs/LOCAL_DOCKER_WALKTHROUGH.md`; the recreated `harmoniarr` service became
  healthy and the documented bootstrap helper confirmed the local admin already
  exists.

## Open Pull Request Review

Open pull request #41 was fetched locally as `codex/pr-41-local` and reviewed
without merging it. It updates development dependencies from an older base.
Current `main` already resolves newer Vue language-server and TypeScript plugin
3.3.11, ESLint 10.9.0, Globals 17.11.0, and Vite 8.2.2 entries. Applying the
pull request would downgrade those resolved packages, so it is not applicable
and was not copied into this change.

## Security Outcome

The UI cannot be the authorization or concurrency authority. Existing route
fresh-session and CSRF controls, app-user scoping, and the import-candidate
service's conditional transactional status transitions remain in force. The
new gate removes the same-client race window but deliberately does not claim
to prevent simultaneous requests from distinct tabs or processes.

## Next Recommended Item

Define and enforce a database-backed release winner for manual match selection.
The design should first settle shared-discovery ownership: a candidate can carry
more than one wanted-release ID, so a simplistic unique index on candidate
status is unsafe. Then add a narrow transaction that:

1. scopes and locks the owned wanted release;
2. verifies no other candidate is selected or in handoff for that release;
3. selects exactly one candidate or returns a stable conflict outcome; and
4. records the operator event and response atomically.

An integration test should submit simultaneous decisions from independent
clients and prove one winner, one conflict, no duplicate download handoff, and
no cross-user effect. Once that invariant is durable, evaluate an
idempotency-key response store for safe network retries.
