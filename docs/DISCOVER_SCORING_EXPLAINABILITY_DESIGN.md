# Discover Scoring And Explainability Design

Status: Implemented
Date: 2026-06-13
Owner: Product + app architecture

## Purpose

This document records the scoring and explanation design for Discover recommended artists.

The immediate goal is to make the current recommendation model easier to reason about without introducing a larger backend recommender rewrite. Discover should show operators why a recommendation is present, while keeping raw engine scores, source names, and fragile ranking internals out of user-facing copy.

## Official Source Review

The review used current official sources available on 2026-06-13:

- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI RMF 1.0 PDF: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf?source=download
- European Commission Digital Services Act overview: https://digital-strategy.ec.europa.eu/en/policies/digital-services-act
- European Commission DSA platform impact and recommender transparency overview: https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms
- W3C ARIA Authoring Practices, Names and Descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- OWASP Cross-Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Vue composables guide: https://vuejs.org/guide/reusability/composables
- MDN JavaScript Modules guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Node.js test runner documentation: https://nodejs.org/api/test.html

Relevant takeaways:

- NIST frames trustworthy AI systems around characteristics such as transparency, accountability, explainability, and interpretability. Discover should therefore expose the main reason categories and strength buckets behind a recommendation instead of showing an unexplained ranked list.
- DSA recommender transparency guidance reinforces the same product direction for recommendation surfaces: explain the main parameters in plain language and avoid opaque personalization controls.
- W3C accessibility guidance favors names and descriptions that convey purpose clearly. Recommendation badges and supporting text should be visible, short, and understandable without relying on hidden-only explanations.
- OWASP guidance keeps the secure rendering baseline simple: use framework escaping, context-safe output, and fixed enumerations for labels derived from untrusted input. Discover should not render raw source strings or score text as HTML.
- Vue and JavaScript module guidance supports extracting reusable logic into ES modules. Because this scoring and explanation logic is stateless, pure client library modules are a better fit than a Vue composable.
- Node's native test runner is sufficient for focused pure-module contract tests and keeps the validation surface lightweight.

## Problem

Before this change, Discover had two weaknesses:

1. Ranking math lived inline in the graph merge function.
2. Explanation copy was split across presentation helpers and did not expose a single stable contract.

That made future tuning risky because a scoring adjustment could silently change card copy, ranking, or tests in different places. It also made it harder to prove that user-facing text was secure, fixed, and free of legacy `seed` / `followed` terminology.

## Options Considered

### Option A: Leave Ranking And Copy Implicit

Pros:

- No code churn.
- No behavior change risk.

Cons:

- Keeps scoring difficult to test.
- Keeps explanation behavior scattered.
- Does not address the plan's explicit scoring/explainability follow-up.

Decision: rejected.

### Option B: UI Copy Only

Pros:

- Fastest visible improvement.
- Low implementation cost.

Cons:

- Does not create a real scoring contract.
- Leaves the graph merge function as the only place where ranking behavior is visible.
- Makes future recommender work harder to validate.

Decision: rejected.

### Option C: Pure Scoring Module Plus Pure Explanation Module

Pros:

- Keeps scoring math isolated and testable.
- Keeps user-facing explanation fields fixed, markup-free, and independent from raw source strings.
- Fits the current client architecture without a backend recommender contract rewrite.
- Preserves the existing ranking shape while making the multi-input boost explicit and bounded.

Cons:

- Still uses a simple heuristic model.
- Does not add per-operator preference controls.
- Does not record explanation payloads server-side for audit.

Decision: accepted.

### Option D: Backend Recommender API Rewrite

Pros:

- Could make scoring and explanation canonical across clients.
- Could support persisted explanation history later.

Cons:

- Larger migration surface.
- Requires route, store, and API contract work beyond this issue.
- Not required to make the current Discover UI explainable and testable.

Decision: deferred.

## Final Recommendation Stack

The implemented stack is:

1. `src/client/lib/discover-recommendation-scoring.js`
   - owns ranking math
   - keeps raw source score as the dominant signal
   - applies a bounded monitored-artist support boost
   - exposes a score breakdown for tests and internal explanation logic

2. `src/client/lib/discover-recommendation-explainability.js`
   - maps raw source strings to stable categories
   - returns fixed provenance, strength, meta, and supporting text fields
   - buckets scores instead of rendering raw numeric values
   - treats unknown or untrusted source strings as `Recommended`

3. `src/client/lib/discover-graph.js`
   - merges per-input similarity results
   - attaches `inputCount`, `inputBoost`, source categories, and `rankScore`
   - sorts by rank score, then shared support, then source score, then name

4. `src/client/lib/discover-presentation.js`
   - delegates recommendation card helpers to the explanation contract
   - preserves existing helper exports for compatibility with current component tests

5. `src/client/views/DiscoverView.vue`
   - builds card view models from one explanation object
   - avoids duplicating score or provenance logic in the component

## Scoring Model

The current ranking formula is intentionally conservative:

```text
rankScore = baseScore + inputBoost
inputBoost = min(0.45, max(0, inputCount - 1) * 0.18)
```

Design intent:

- `baseScore` remains the main signal from the underlying similarity source.
- `inputBoost` breaks close calls when multiple monitored artists independently point to the same candidate.
- The cap prevents broad overlap from overpowering a much stronger single-source recommendation.
- Source provenance affects explanation copy, not ranking.

## Explainability Model

Discover now exposes four operator-facing explanation fields:

- provenance badge: `Related artist`, `Listener overlap`, `Related + listeners`, or `Recommended`
- strength label: `Strong overlap`, `Moderate overlap`, or `Emerging overlap`
- meta line: single-input or shared-by-count copy
- supporting line: one sentence explaining the strongest available reason

The UI does not render raw numeric scores. It also does not render raw engine source names.

## Security Notes

- Explanation labels are fixed enumerations.
- Unknown source strings are ignored rather than reflected.
- Vue interpolation remains the rendering path for card text.
- No `v-html` path is introduced.
- Raw scores are available only for tests and internal logic, not user-facing copy.

## Accessibility And Product Language Notes

- The visible card text explains purpose directly rather than relying only on hidden labels.
- Copy uses monitored artists and recommendations terminology.
- Legacy `seed`, `followed`, and graph jargon remain out of user-facing Discover copy.

## Implementation Outcome

Implemented files:

- `src/client/lib/discover-recommendation-scoring.js`
- `src/client/lib/discover-recommendation-explainability.js`
- `src/client/lib/discover-graph.js`
- `src/client/lib/discover-presentation.js`
- `src/client/views/DiscoverView.vue`
- `test/client/discover-recommendation-scoring.test.js`
- `test/client/discover-recommendation-explainability.test.js`
- `test/client/discover-graph.test.js`
- `test/client/discover-presentation.test.js`

Validation performed:

- `node --test test/client/discover-recommendation-scoring.test.js test/client/discover-recommendation-explainability.test.js test/client/discover-graph.test.js test/client/discover-presentation.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `npm run check:esm`
- `npm run build:client`
- `git diff --check`
- `node --test test/client/discover-artist-card-contract.test.js test/client/discover-artist-card-presentation.test.js`
