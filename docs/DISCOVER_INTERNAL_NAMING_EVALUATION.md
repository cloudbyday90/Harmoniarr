# Discover Internal Naming Evaluation

## Status

Completed on 2026-06-13.

This document evaluates the remaining internal `seed` terminology after the user-facing Discover terminology guard, card-state contract, and refresh browser regression were completed.

## Goal

Decide whether the remaining internal `seed` naming should be renamed now, deferred, or left alone.

The product model is already locked:

- monitored artists are the durable operator-managed set
- recommended artists are derived from monitored artists and similarity sources
- Discover must not imply a second persistent seed collection

The evaluation therefore focuses on maintainability and future regression risk, not user-facing copy.

## Audit Summary

### Highest-risk client naming

`src/client/composables/useDiscoverGraph.js`

Current names:

- `seeds`
- `seedResults`
- `loadingSeeds`
- `seedIds`
- `isAnySeedLoading`
- `hasSeeds`
- `isSeed`
- `addSeed`
- `hydrateSeeds`
- `removeSeed`
- `clearSeeds`

Assessment:

- This is the central source of the outdated mental model.
- `hydrateSeeds(monitoredArtists)` now hydrates from the operator monitored profile, so `seed` no longer describes the product contract.
- The composable return shape leaks the legacy model into `DiscoverView.vue`, tests, comments, and artwork source wiring.

Recommended direction:

- Rename this composable contract in the next implementation pass.
- Preferred terms:
  - `seeds` -> `recommendationInputs`
  - `seedResults` -> `inputResults`
  - `loadingSeeds` -> `loadingInputs`
  - `seedIds` -> `recommendationInputIds`
  - `isAnySeedLoading` -> `isAnyInputLoading`
  - `hasSeeds` -> `hasRecommendationInputs`
  - `isSeed` -> `isRecommendationInput`
  - `addSeed` -> `addRecommendationInput`
  - `hydrateSeeds` -> `hydrateRecommendationInputs`
  - `removeSeed` -> `removeRecommendationInput`
  - `clearSeeds` -> `clearRecommendationInputs`

### Medium-risk presentation wiring

`src/client/views/DiscoverView.vue`

Current names:

- destructured `seeds`, `addSeed`, `hydrateSeeds`, `isSeed`
- `monitoredChips` maps over `seeds`
- comments refer to a "seed chip"
- summary count renders `seeds.length` as monitored count

Assessment:

- This file is user-facing UI orchestration, so internal names matter more here than in a pure algorithm helper.
- The rendered copy is correct, but future contributors reading the container could infer that Discover still manages a separate seed list.

Recommended direction:

- Rename usage alongside the composable contract.
- Prefer `recommendationInputs` for the composable state and `monitoredChips` for the UI model.
- Replace comments with "monitored artist chip" or "recommendation input chip" depending on context.

`src/client/components/media/DiscoverRecommendationsPanel.vue`

Current names:

- comments refer to seed chips
- CSS classes use `.discover-seed-*`

Assessment:

- No user-facing copy leak.
- CSS class names are implementation details, but they are visible in DOM and can influence future tests.
- A CSS-only rename is safe but touches many selectors.

Recommended direction:

- Rename classes in the same implementation pass as `DiscoverView.vue` to avoid mixed terms.
- Preferred class family:
  - `.discover-seed-band` -> `.discover-monitored-band`
  - `.discover-seeds` -> `.discover-monitored-list`
  - `.discover-seed-chip` -> `.discover-monitored-chip`

### Medium-risk scoring contract

`src/client/lib/discover-graph.js`

Current names:

- `seedResults` parameter
- `seedCount` output field
- comments refer to seeds and per-seed results

Assessment:

- This is a pure scoring helper, so the risk is lower than the view/composable.
- `seedCount` flows into `buildRecommendationMeta()` and tests.
- Renaming the output field without an alias would be a behavior contract change inside the client.

Recommended direction:

- Rename in a second step after the composable/view rename.
- Preferred terms:
  - `seedResults` -> `inputResults`
  - `seedCount` -> `inputCount`
- During the transition, support `inputCount` in presentation helpers and keep `seedCount` as a temporary backward-compatible alias only inside tests or adapter code.

### Low-risk server similarity internals

`src/server/metadata/similar-artists-service.js`

Current names:

- `seedGenres`
- `seedTags`
- comments such as "seed artist"

`src/server/metadata/similar-artists-fallback-service.js`

Current names:

- `seedArtist`
- `seedProfile`
- `createSeedSignalProfile`

Assessment:

- The public route remains `/api/v1/metadata/artists/:artistId/similar`.
- The client API uses `fetchSimilarArtists(artistId)`.
- Server `seed` terminology here is algorithm-local: one artist is the source input for a similarity query.
- Renaming now would create broad test churn without improving the Discover product model.

Recommended direction:

- Do not rename server similarity internals in the Discover cleanup pass.
- Revisit only if a future public recommendation service introduces operator-profile-level terminology.

### Historical and design docs

Several design/archive documents intentionally mention `seed` to describe previous states or prior decisions.

Assessment:

- Historical docs should not be rewritten wholesale.
- Active docs should use current terminology when updated.

Recommended direction:

- Leave archived historical references.
- For active Discover implementation docs, add new notes rather than mutating old decision context.

## Options

### Option A: No internal rename

Pros:

- Zero implementation risk.
- Existing tests and CSS remain untouched.

Cons:

- Maintains the biggest remaining source of conceptual drift.
- Future Discover work may reintroduce off-model terminology.

Decision: reject.

### Option B: Rename only comments/docs

Pros:

- Very low risk.
- Improves some readability.

Cons:

- Leaves the code contract with `seeds`, `addSeed`, and `hydrateSeeds`.
- Does not solve the actual maintainer-facing problem.

Decision: reject as insufficient.

### Option C: Rename client Discover graph boundary only

Pros:

- Targets the main maintainability problem.
- Keeps server algorithm-local names stable.
- Can be covered with existing client, browser, and presentation tests.
- Avoids database/API migration risk.

Cons:

- Touches Discover view, composable tests, graph tests, and CSS selectors.
- Requires careful transition around `seedCount`.

Decision: accept.

### Option D: Rename all server and client seed terminology

Pros:

- Maximum terminology consistency.

Cons:

- High churn across similarity services, fallback services, and server tests.
- Server `seedArtist` is still a reasonable algorithm term for one-source similarity queries.
- Does not improve current user-facing Discover behavior.

Decision: reject for this phase.

## Final Recommendation

Proceed with a scoped client-only rename in the next implementation pass.

Implementation order:

1. Rename `useDiscoverGraph` internal state and returned contract from `seed` to `recommendationInput`.
2. Update `DiscoverView.vue` to use `recommendationInputs`, `hydrateRecommendationInputs`, and `addRecommendationInput`.
3. Rename `DiscoverRecommendationsPanel.vue` comments and CSS classes from `seed` to `monitored` or `recommendationInput`, using `monitored` for visible chip/band classes.
4. Update `discover-graph.js` comments and parameters from `seedResults` to `inputResults`.
5. Add `inputCount` while keeping a temporary `seedCount` alias only if needed to preserve presentation helper compatibility during the same patch.
6. Update focused client tests:
   - `test/client/useDiscoverGraph.test.js`
   - `test/client/discover-graph.test.js`
   - `test/client/discover-presentation.test.js`
7. Run focused validation:
   - `node --test test/client/useDiscoverGraph.test.js test/client/discover-graph.test.js test/client/discover-presentation.test.js`
   - `npm run lint:client`
   - `npm run lint:test`
   - `npm run build:client`
   - `node --test --test-concurrency=1 test/browser/discover-refresh-regression.test.js`

Non-goals for the rename pass:

- server similarity-service renames
- route or API changes
- database schema changes
- archived design document rewrites

## Implementation Follow-Up

Implemented on 2026-06-13 in the scoped rename pass documented by
`DISCOVER_INTERNAL_NAMING_RENAME_DESIGN.md`.
