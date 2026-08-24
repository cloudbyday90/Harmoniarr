# Music Queue Shared Selection Guard Outcome

## Delivered

On 2026-08-23, Harmoniarr gained server-side concurrency protection for
Music Queue candidate selection.

- Added `import-candidate-music-queue-selection-guard.js`, a small ESM service
  that locks the current shared discovery request and checks for an existing
  active candidate.
- Wired the guard into the central import-candidate status transition path for
  every transition to `selected`.
- Added `409 music_queue_candidate_already_active` for a competing selection.
  Its response is intentionally generic and contains no peer or candidate
  identity.
- Kept the candidate status update and the durable candidate event in the same
  transaction.
- Revalidated the Music Queue list after that specific server conflict so a
  stale page shows the active work before displaying the error feedback.
- Added unit and PostgreSQL integration coverage, including the independent
  release case.

No database migration was added. The shared discovery-request row already
provides the correct durable resource to lock. Adding a unique index to
`import_candidates` would be incorrect because candidates legitimately serve
multiple operator-owned wanted releases.

## Validation

The following checks passed after the implementation:

| Check | Result |
| --- | --- |
| Import-candidate, guard, acquisition-pipeline server tests | 50 passing |
| Shared-discovery and new PostgreSQL concurrency tests | 2 passing |
| Concurrency assertions | One shared winner, one `409` conflict, no duplicate selected event, unrelated release selected |

Full repository validation, build, ESM verification, and the local Compose
walkthrough remain required before the final commit for this change.

## Open PR assessment

The available local copy of open PR #41 (`codex/pr-41-local`, commit
`e210d0f`) was inspected rather than merged. It is substantially behind
`main`; applying it would remove later Music Queue, Artist Detail cache,
single-node deployment, supply-chain, and test work. It was therefore not
applied locally. A live GitHub PR query could not be refreshed because the
local GitHub CLI credential is unauthorized, so this assessment is limited to
the checked-out PR branch.

## Next recommended work

Add a narrow idempotency-response store for externally retried mutation
requests, beginning with Music Queue match selection. The new selection guard
prevents competing choices; idempotency would additionally let a repeated
request return its original successful result without redoing audit work or
forcing the client to infer whether the first response was lost.
