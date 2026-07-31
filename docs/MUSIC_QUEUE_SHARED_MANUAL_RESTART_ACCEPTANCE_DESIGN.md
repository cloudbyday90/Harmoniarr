# Music Queue Shared Manual Restart Acceptance

Status: **Implemented and validated.**

Date: 2026-07-30.

This document records the shared-release recovery slice that follows the
bounded automatic recovery stop. Two household operators can want the same
release, but only one person may restart the shared provider search. The other
person receives the current automatic state without creating duplicate work or
seeing private policy data.

## Official Sources Reviewed

| Source | Design input |
| --- | --- |
| [PostgreSQL `UPDATE`](https://www.postgresql.org/docs/18/sql-update.html) | A conditional `UPDATE ... RETURNING` is the database-local compare-and-set primitive for one global restart winner. |
| [PostgreSQL `SELECT`](https://www.postgresql.org/docs/18/sql-select.html) | Row-level locking exists for multi-step transactions, but this transition can remain one predicate-protected write and a follow-up read. |
| [IETF Idempotency-Key draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header) | Idempotency needs a defined scope. Shared request state, rather than a client-provided key, coordinates concurrent owners. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Authorization is enforced on every release read and action; a shared backend record must not weaken operator-scoped views. |
| [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts) | Separate browser contexts model the two authenticated owners without shared browser state. |
| [Playwright Assertions](https://playwright.dev/docs/test-assertions) | Web-first assertions verify observable state transitions rather than timing delays. |

## Decisions

1. A bounded shared stop is restarted with one conditional database update.
   The winner clears terminal recovery evidence and opens the global request.
   A concurrent owner receives `already_queued` after a fresh read, starts no
   run, and records no duplicate Activity event.

2. The global request stores only safe restart context. The initiating
   wanted-release link alone records local restart provenance, so sibling
   ownership and policy do not leak through a shared row.

3. The winner starts one normal library-discovery run. Existing automatic
   selection and download services still choose the match and queue transfer;
   manual candidate selection is not added to the normal Music Queue path.

4. Release-scoped Music Queue Activity is identity-redacted. The underlying
   audit ledger retains actor and request metadata, while the household Activity
   row contains only release-safe progress and route data.

5. Mutation responses update selected Music Queue detail immediately and
   invalidate older direct-read responses, preventing stale stopped state from
   replacing a successful restart response.

6. The controlled-provider Compose overlay suppresses background service
   startup only for its isolated verifier process. The verifier manually owns
   worker execution and leases; ordinary deployments start services normally.

## Options Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Let every owner restart independently | Simple handler. | Duplicates provider work and Activity rows; races shared recovery state. | Reject. |
| Require a user-supplied idempotency key | Familiar HTTP pattern. | Does not coordinate distinct users acting on one release; adds client complexity. | Reject. |
| Lock then perform multiple updates | Explicit transaction control. | More round trips and lock duration for a natural predicate-protected write. | Reject. |
| Conditional global update plus fresh loser read | One winner, bounded work, and clear retry outcome. | Requires careful predicates and acceptance coverage. | Adopt. |
| Put actor identity in Music Queue Activity | Immediate attribution. | Leaks household identity into a release-facing feed and duplicates audit responsibility. | Reject. |
| Leave direct detail read-only after mutation | Less client code. | Can display stale stopped state after a successful restart. | Reject. |

## Final Recommendation Stack

### Shared State and Services

- `library-discovery-request-store.js` atomically accepts one restart, resets
  terminal recovery evidence, and returns `started` or `already_queued`.
- `acquisition-pipeline-service.js` starts one discovery run and Activity row
  for the winner, while reporting an already-active shared restart to the loser.
- `music-queue-lifecycle-activity-event-service.js` writes release-safe
  lifecycle Activity without actor identity.
- `acquisition-pipeline-status-service.js` shows `Downloading` when an
  automatic execution item is pending rather than leaving it at `Checking
  matches`.

### Client Stack

- `useMusicQueue.js` explains that another owner has already queued the search.
- `useMusicQueueReleaseDetail.js` accepts mutation state and invalidates old
  detail requests.
- `MusicQueueView.vue` applies returned release state before a fallback reload.

### Validation Stack

- Store and service tests prove winner/loser behavior, no duplicate run, and
  release-safe Activity payloads.
- Two isolated Playwright sessions prove one `Search again` request, shared
  progress, and reciprocal copied-link denial.
- Disposable controlled-provider Compose proof covers one restart search, one
  successful retry transfer, two `Ready to add` outcomes, redaction, and
  cleanup.

## Security and Privacy

- The global transition is reached only after the caller's operator-scoped
  wanted release is resolved.
- A losing owner learns only that a search is queued, never sibling identity,
  policy, or local intent.
- Audit retains actor attribution; Music Queue Activity does not.
- `HARMONIARR_TEST_DISABLE_BACKGROUND_SERVICES=true` exists only in the
  isolated validation overlay, not production, walkthrough, or managed-provider
  Compose configurations.
- Synthetic generated tones and temporary paths keep the proof independent of
  live peers, recordings, secrets, and persistent test files.

## Outcome

One operator's `Search again` creates one shared automatic restart. A
concurrent owner sees the work already underway. Once a viable match is found,
normal automatic transfer and safe add-to-library flow resume for both scoped
Music Queue releases.

Recommended next slice: make post-download add blockers release-centred. A
path, media-verification, collision, or unsafe import-plan problem should
present one clear `Needs help adding` action and Activity handoff, while
candidate and import internals remain under Advanced diagnostics.
