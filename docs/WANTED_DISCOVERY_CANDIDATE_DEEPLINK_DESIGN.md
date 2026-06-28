# Wanted Discovery Candidate Deep Link Design

Status: Implemented
Date: 2026-06-27

## Purpose

Wanted rows already show whether the most recent discovery dispatch produced
Import Review candidates. The missing workflow step was a direct, low-risk
handoff from that row to the matching candidate list.

This design adds an `Open candidates` link for rows whose dispatch evidence
contains both:

- a positive `lastSearchResult.candidateCount`
- a non-empty `lastSearchId`

The link opens Import Review filtered by `sourceSearchId` so the operator lands
on the candidate set created by that discovery search.

## Research Summary

- Vue Router's official navigation model supports declarative route locations
  with named routes, query params, and hashes. That fits this case because the
  target view already has a route-state contract.
- Playwright's official locator guidance favors user-visible roles and text for
  browser verification. The browser proof should click the visible link and
  assert the resulting route/query plus visible candidate content.
- OWASP REST and API authorization guidance keeps authorization checks on the
  server/API boundary. The client link is only a navigation affordance; it must
  not expose provider secrets or create a new privileged read path.

## Options Considered

### Option A: Keep Wanted row text only

Pros:

- No new UI surface.
- No route-state changes.

Cons:

- Leaves operators to manually find the matching Import Review candidates.
- Makes dispatch success less actionable.

### Option B: Deep-link directly to a specific candidate id

Pros:

- Opens a precise candidate detail when there is one candidate.

Cons:

- Dispatch evidence does not guarantee a stable candidate id for all result
  shapes.
- Multi-candidate searches would still need a filtered list.
- Tighter coupling to Import Review candidate identity than the row needs.

### Option C: Link to Import Review filtered by source search id

Pros:

- Reuses the existing Import Review `sourceSearchId` filter contract.
- Handles one or many candidates from the same discovery search.
- Does not require a schema, route, or API change.
- Keeps the row payload bounded to route-safe identifiers.

Cons:

- If the candidate set is later removed, the link can open an empty filtered
  queue.
- It selects the search result set, not a specific candidate detail row.

## Final Recommendation

Use Option C.

Add a pure ESM helper that reads `discoveryRequest.evidence.lastSearchId` and
`lastSearchResult.candidateCount`, then returns a Vue Router named-route
location for `activity-candidates` with:

- `sourceSearchId=<lastSearchId>`
- `status=all`
- `#import-review-selection-stage`

Render the link only when the helper returns a location.

## Security Notes

- The link forwards only `sourceSearchId` and `status`.
- Raw search query text, provider response bodies, API keys, and other evidence
  fields are not routed.
- Existing server authorization remains unchanged. Wanted discovery details are
  still operator/admin-only, and Import Review still enforces its existing API
  access rules.
- No new mutation endpoint or privileged API route is introduced.

## Implementation Outcome

- `src/client/lib/wanted-discovery-candidate-link.js` contains the pure link
  builder and candidate-evidence predicate.
- `ActivityWantedView.vue` renders `Open candidates` in the Discovery column
  for candidate-producing rows.
- `testing/browser/wanted-browser-fixtures.js` seeds the matching Import Review
  candidate workspace before navigation.
- `test/browser/activity-releases-wanted-browser-verification.test.js` clicks
  the link and verifies the Import Review route is filtered to the expected
  discovery search id.

## Validation

Focused validation:

- `node --test test/client/wanted-discovery-candidate-link.test.js test/client/wanted-release-normalization.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/activity-releases-wanted-browser-verification.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `git diff --check`
