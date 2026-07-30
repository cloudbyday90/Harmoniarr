# Music Queue Shared Discovery Browser Acceptance

Status: **Implemented.**

Date: 2026-07-30.

This browser acceptance closes the UI and route-layer gap left after
[MUSIC_QUEUE_SHARED_DISCOVERY_DOCKER_ACCEPTANCE_DESIGN.md](MUSIC_QUEUE_SHARED_DISCOVERY_DOCKER_ACCEPTANCE_DESIGN.md).

## Problem

One provider search can serve equivalent missing releases for more than one
operator, while each operator must see only their own wanted-release ID and
Activity handoff. The packaged Docker acceptance already proves the production
service returns scoped 404s. Before this work, however, the Music Queue view
resolved a deep link only against its loaded list. A copied URL could therefore
leave an empty detail pane instead of a deliberate, safe unavailable state.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Playwright isolation](https://playwright.dev/docs/browser-contexts) | Browser contexts isolate cookies, local storage, and sessions; multiple contexts are appropriate for one multi-user scenario. | Use two independent `BrowserContext` instances in one acceptance scenario, never logout and reuse one session. |
| [Playwright authentication](https://playwright.dev/docs/auth) | Stateful tests should use distinct accounts; persisted authentication state can contain reusable credentials and must not be committed. | Bootstrap unique disposable accounts through the test runtime, retain their state only in memory, and close both contexts in `finally`. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce authorization for each object request, deny by default, and test object-level authorization. | A route-selected release is loaded from the scoped direct endpoint, not inferred solely from the queue list. |
| [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) | Test with separate identities and valid identifiers owned by the other user; non-guessable IDs do not replace authorization. | Each session opens the other operator's valid release URL and requires the generic unavailable UI state. |

## Options Considered

### Switch accounts in one browser context

Pros: smaller test setup.

Cons: session and storage cleanup become part of the behavior under test; it
cannot catch accidental state carryover between simultaneous operator views.

Decision: rejected.

### Assert the scoped server API only

Pros: fast and already covered by the Docker acceptance.

Cons: does not prove a copied client route requests scoped evidence or renders
a coherent, non-disclosing state.

Decision: insufficient alone.

### Two isolated browser contexts with deterministic scoped read models

Pros: proves normal UI, Activity handoffs, detail-route scope, session
isolation, and redaction without duplicating long-running provider work.

Cons: the browser read model is deterministic rather than a second full
provider execution test.

Decision: adopted, paired with the existing packaged Docker proof.

## Final Recommendation Stack

1. Keep shared provider work durable and global, but project distinct
   operator-owned wanted-release IDs.
2. Resolve every `/app/music-queue/:wantedReleaseId` route through the scoped
   `GET /api/v1/acquisition/releases/:wantedReleaseId` endpoint.
3. Render only the generic `Release not available` state for the established
   `music_queue_release_not_found` response. Do not identify whether the
   release exists, belongs to another operator, or was removed.
4. Keep the normal list request for queue context, but never use its page size
   as deep-link authorization or existence evidence.
5. Exercise separate browser contexts with two real disposable operator
   sessions. Assert each Activity event links only to that session's wanted
   release ID and omits private policy markers.
6. Retain service, route, and Docker authorization tests as the security
   source of truth; browser tests prove client composition and redaction.

## Security Boundary

- Direct detail reads remain authorized by `appUserId` in the server's scoped
  Music Queue service. The client does not decide ownership.
- The unavailable state has intentionally generic wording and contains no
  release title, owner, policy, status, or metadata.
- The acceptance fixture returns the same `404 music_queue_release_not_found`
  contract for another operator's valid ID and for an absent ID.
- Two private marker values travel only in fixture payloads. Assertions require
  that neither marker nor the sibling wanted-release ID reaches normal Music
  Queue or Activity text.
- Browser sessions, routes, and handlers are always released during scenario
  cleanup; no authentication state or fixture data is written to the
  repository.

## Implementation Outcome

- `useMusicQueueReleaseDetail` is a focused ESM composable that loads the
  selected route ID from the scoped direct endpoint, protects against stale
  responses, and classifies only the established 404 contract as unavailable.
- `MusicQueueReleaseUnavailable` gives a calm normal-state recovery path back
  to the operator's queue.
- `MusicQueueView` retains its list context while using the direct read for
  selected release detail and refreshes both reads together.
- `installScopedMusicQueueReadModelFixtures` supplies deterministic scoped
  list, direct-detail, Activity, and provider-health reads for browser tests.
- The new two-session acceptance creates an admin and an operator, validates
  the same shared `Downloading` status and each own Activity handoff, then
  checks copied URLs in both directions.

## Validation

```text
npm run lint:client
npm run lint:test
node --test test/client/use-music-queue-release-detail.test.js
npm run build:client
node --test --test-concurrency=1 test/browser/music-queue-shared-discovery-browser-acceptance.test.js
```

## Next High-Value Item

Add a shared-release recovery acceptance journey: force one selected provider
match to fail, prove the provider retry chain is still singular, then prove
both operator sessions receive their own `Trying another match` and eventual
`Downloading` or bounded stop Activity story without sibling policy leakage.
