# Music Queue Shared Bounded-Stop Acceptance

Status: **Implemented and validated.**

Date: 2026-07-30.

This document extends
[MUSIC_QUEUE_SHARED_RECOVERY_ACCEPTANCE_DESIGN.md](MUSIC_QUEUE_SHARED_RECOVERY_ACCEPTANCE_DESIGN.md)
with the terminal branch of shared automatic recovery.

## Problem

Two people can want one release, while provider search, matching, transfer,
and the bounded retry budget remain global. When the final eligible match
fails and that global budget is spent, Harmoniarr must stop once. It must not
create a second fallback worker or another automatic provider search for each
person. Both people still need a clear release-scoped `Search again` action
and a readable Activity handoff.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext) | A browser context is an isolated, incognito-like session. | Verify two real isolated sessions rather than changing one session's client state. |
| [Playwright assertions](https://playwright.dev/docs/test-assertions) | Web-first assertions wait for user-observable state. | Assert labels, release actions, and safe route handoffs rather than implementation timing. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce object-level authorization and deny by default. | Retain per-user Music Queue reads and prove a sibling's valid release ID yields the generic unavailable response. |
| [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) | Identifier entropy does not replace authorization checks. | Treat the other user's known wanted-release ID as hostile input in both acceptance layers. |
| [Node.js test runner](https://nodejs.org/api/test.html) | Tests should bound asynchronous work and clean up their resources. | Use the existing disposable Compose project, generated API key, generated media roots, bounded polling, and unconditional teardown. |

## Options Considered

### Keep retrying until a provider response works

Pros: fewer visible stops.

Cons: unbounded provider load, repeated failed transfers, and no predictable
point for a household member to intervene.

Decision: rejected.

### Stop the first time a selected match fails

Pros: simple implementation and minimal provider work.

Cons: discards already-ingested, eligible fallback matches and makes normal
provider transience look like a terminal problem.

Decision: rejected.

### Use one bounded global retry budget, then stop once

Pros: preserves automatic fallback and controlled rediscovery while preventing
duplicate searches, workers, and transfers for shared releases. It gives every
owner one predictable release-level recovery action.

Cons: requires explicit terminal state, safe Activity fan-out, and end-to-end
proof across two owners.

Decision: adopted.

## Final Recommendation Stack

1. Keep the existing single global `library_discovery_requests` retry counter
   for the metadata release; do not create per-user recovery workers.
2. When the counter reaches its limit, persist the global request as blocked
   with `download_recovery_exhausted`, clear any future search time, and start
   no fallback execution or discovery run.
3. Project both linked Music Queue releases as `No matches left` with the
   existing release-scoped `Search again` action.
4. Emit one `music_queue_no_matches_left` Activity row per wanted release with
   only its own ID, `rediscoveryExhausted: true`, and no hidden automatic retry.
5. Keep direct Music Queue detail object-authorized. Activity is household
   history, so its rows must remain correlation-safe rather than claiming
   per-user authorization.
6. Prove the production path in the controlled provider: one search, one
   failed transfer, no additional work after two repeat dispatcher passes.
7. Prove the visible contract in two isolated browser contexts, including the
   generic unavailable state for copied sibling deep links.

## Security Boundary

- Provider work is global only; per-user policy markers and account IDs do not
  enter candidates, Activity payloads, or normal Music Queue projections.
- Candidate request ownership is stored only when a real
  `sourceMediaRequestId` exists. Shared monitored discovery deliberately
  stores no ownership object, even when reconciliation has associated it with
  operator-scoped wanted releases.
- Candidate recovery receives its metadata-release correlation through the
  separate, sanitized `discoveryScope`. It contains no user, policy, path, or
  request identifiers, so removing shared ownership does not disable bounded
  fallback recovery. The recovery lookup also supports legacy candidate rows
  whose metadata correlation was stored under request ownership.
- A strict-quality rejection may cascade only to an already-ingested,
  quality-eligible match. When none remains, Harmoniarr stops for a quality
  choice; it does not rediscover automatically and risk repeatedly selecting
  the same unsuitable audio.
- Terminal Activity exposes only the boolean needed for friendly copy. It does
  not expose raw provider errors, candidate IDs, source users, paths, or the
  shared retry counter.
- The direct detail endpoint remains the authorization boundary. A sibling
  wanted-release ID returns the established generic `music_queue_release_not_found`
  response.
- The controlled provider fixture is private to the disposable Compose network,
  protected by a run-specific API key, and removed with generated files,
  containers, volumes, and temporary directories after the test.

## Implementation Outcome

- Recovery Activity now classifies an exhausted rediscovery as
  `music_queue_no_matches_left` and records the sanitized
  `rediscoveryExhausted` signal.
- Music Queue gives an explicit terminal discovery state precedence over
  failed historical candidates, so people see `No matches left` and `Search
  again` rather than an unusable `Pick a match` prompt.
- Activity copy now distinguishes a scheduled automatic search from the
  terminal, user-actionable bounded stop.
- The controlled provider catalog contains one single-match shared fixture
  whose transfer fails. The verifier preloads its global retry counter to the
  production cap, exercises the real terminal store transition, then proves
  two repeat dispatches create no provider work.
- The verifier derives its shared fixture from persisted artist monitoring and
  the production wanted/discovery reconcilers. This prevents a background
  reconciliation from deleting synthetic test rows and verifies the same
  durable source used after container restarts.
- The verifier wires bounded rediscovery through the same late-bound
  import-to-library callback used by application startup, so its terminal
  proof exercises the real global request transition instead of a test-only
  no-op dependency.
- The verifier confirms two redacted terminal Activity rows, two scoped Music
  Queue `No matches left` projections with `try_again`, one failed transfer,
  no active fallback run, and reciprocal direct-detail 404s.
- A two-context browser acceptance journey verifies the household-facing
  `No matches left` label, `Search again` control, Activity handoff, and
  sibling-link denial without exposing private fixture markers.
- The shared browser acceptance suite serializes its scenarios. They reuse a
  disposable runtime that temporarily sets process-wide PostgreSQL connection
  variables, so concurrent scenarios could otherwise interrupt each other and
  yield a false Activity-feed failure.
- The controlled-provider verifier timeout accommodates the complete isolated
  pipeline, while each internal worker wait remains bounded and its Compose
  project is always removed.

## Validation

```text
npm run lint
npm run test:server
npm run test:client
npm run build
node --test --test-concurrency=1 test/browser/music-queue-shared-recovery-browser-acceptance.test.js
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

All commands passed on 2026-07-30. The server suite completed 2,970 tests;
the client suite completed 4,031 tests; and the isolated browser acceptance
proved both the normal shared-fallback journey and the terminal bounded-stop
journey. The no-cache controlled-provider run verified 17 synthetic fixtures
and 20 ingested matches, including the persisted global stop, redacted
two-owner fan-out, and absence of duplicate provider work after repeat
dispatches. Its disposable Compose project, generated media, database volume,
and run-specific credential were removed by the validation cleanup.

## Next High-Value Item

Add shared-release manual restart acceptance. One owner should use `Search
again` after the bounded stop, resetting the one global retry state exactly
once, starting at most one shared rediscovery, and returning both scoped
releases to the normal automatic story without altering the other owner's
policy.
