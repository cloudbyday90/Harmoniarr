# Discover Internal Naming Rename Design

## Status

Implemented on 2026-06-13.

This document records the recommendation, tradeoffs, implementation outcome, and validation for the scoped client-only rename from legacy `seed` terminology to recommendation-input terminology.

## Problem

The Discover UI now presents monitored artists as the recommendation basis, and browser coverage proves reload behavior after adding multiple monitored artists. The remaining issue is maintainability: the client Discover graph still exposed a `seed`-based composable contract, which could lead future work back toward a separate persistent seed mental model.

The rename must improve code clarity without changing product behavior, API routes, database state, or server similarity internals.

## Official Research

Research was performed against official sources in June 2026 for practices current as of May 2026.

- Vue Composables: https://vuejs.org/guide/reusability/composables
  - Vue defines composables as functions that encapsulate and reuse stateful logic.
  - Vue recommends camelCase composable names beginning with `use`.
  - Vue recommends returning a plain object of refs so destructuring retains reactivity.
- Vue SFC CSS Features: https://vuejs.org/api/sfc-css-features
  - Scoped SFC CSS applies to elements in the current component and is transformed by Vue tooling, so component-local class renames are safe when template and style are updated together.
- Node.js ECMAScript Modules: https://nodejs.org/api/esm.html
  - ECMAScript modules are the official standard format for reusable JavaScript code, and Node supports `.js` ESM through the package `"type": "module"` field.
- Node.js Test Runner: https://nodejs.org/api/test.html
  - `node:test` is stable and supports synchronous and promise-based tests.
- Playwright Best Practices: https://playwright.dev/docs/best-practices
  - Browser regressions should use web-first waiting/assertion behavior and stable user-facing locators.
- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
  - UI data should be rendered as text through framework output encoding rather than interpreted as code.
- W3C WAI-ARIA Accessible Names and Descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
  - Accessible names convey purpose and distinguish elements; visible text should be preferred where practical.

## Options

### Option A: Leave internal naming unchanged

Pros:

- No implementation risk.
- No test churn.

Cons:

- Leaves the main maintainer-facing mismatch.
- Future Discover changes may reintroduce the deprecated product model.

Decision: reject.

### Option B: Rename comments only

Pros:

- Low risk.
- Improves some readability.

Cons:

- Leaves `seeds`, `addSeed`, and `hydrateSeeds` as the active composable contract.
- Does not address the code surface most likely to shape future work.

Decision: reject.

### Option C: Rename client graph boundary and Discover wiring

Pros:

- Fixes the main conceptual mismatch.
- Keeps the change inside client code and tests.
- Preserves existing API routes and server similarity internals.
- Covered by focused client tests plus the existing Discover browser refresh regression.

Cons:

- Touches composable contract, view wiring, CSS classes, and tests.
- Requires a controlled scoring-object rename from `seedCount` to `inputCount`.

Decision: accept.

### Option D: Rename all server and client `seed` terminology

Pros:

- Maximum terminology consistency.

Cons:

- High churn across server similarity services and tests.
- Server `seedArtist` remains a reasonable algorithm-local term for a one-source similarity query.
- Adds no current product value because public route/API language is already neutral.

Decision: reject for this phase.

## Final Recommendation Stack

Implement Option C.

- Client composable contract:
  - `seeds` -> `recommendationInputs`
  - `seedResults` -> `inputResults`
  - `loadingSeeds` -> `loadingRecommendationInputs`
  - `seedIds` -> `recommendationInputIds`
  - `isAnySeedLoading` -> `isAnyRecommendationInputLoading`
  - `hasSeeds` -> `hasRecommendationInputs`
  - `isSeed` -> `isRecommendationInput`
  - `addSeed` -> `addRecommendationInput`
  - `hydrateSeeds` -> `hydrateRecommendationInputs`
  - `removeSeed` -> `removeRecommendationInput`
  - `clearSeeds` -> `clearRecommendationInputs`
- Scoring contract:
  - `seedResults` parameter -> `inputResults`
  - `seedCount` output -> `inputCount`
- Discover view:
  - hydrate from monitored artists into `recommendationInputs`
  - keep rendered copy unchanged
  - preserve focus return behavior through monitored artist chips
- Recommendation panel:
  - rename component-local classes and comments to monitored/recommendation wording
  - keep accessible labels and visible copy unchanged
- Security:
  - continue rendering artist names through Vue template interpolation/attributes
  - do not introduce `v-html`, dynamic script execution, new route parameters, or new storage
- Validation:
  - focused client tests for graph, presentation, and composable behavior
  - lint client/test code
  - client production build
  - focused Discover browser refresh regression

## Implementation Outcome

The implementation keeps server similarity services unchanged and applies the rename to the Discover client boundary only.

Expected behavior remains unchanged:

- Discover hydrates from monitored artists.
- Adding an artist still refreshes recommendations in the background.
- The monitored count and recommended count render the same values.
- Recommendation meta still says `Shared by N of your monitored artists`.
- Browser reload regression remains the end-to-end guard.

Validation completed:

- `node --test test/client/useDiscoverGraph.test.js test/client/discover-graph.test.js test/client/discover-presentation.test.js test/client/useDiscoverArtistArtwork.test.js test/client/use-add-artist-modal-contract.test.js` - 127/127 passing.
- `npm run lint:client` - passing.
- `npm run lint:test` - passing.
- `npm run build:client` - passing.
- `npm run check:esm` - passing.
- `node --test --test-concurrency=1 test/browser/discover-refresh-regression.test.js` - passing.
- `git diff --check` - passing.
