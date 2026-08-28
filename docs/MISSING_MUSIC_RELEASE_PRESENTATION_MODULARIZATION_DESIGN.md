# Missing Music Release Presentation Modularization — Design

## Status

Implemented and awaiting final repository validation on 2026-08-28. The companion record is [MISSING_MUSIC_RELEASE_PRESENTATION_MODULARIZATION_OUTCOME.md](./MISSING_MUSIC_RELEASE_PRESENTATION_MODULARIZATION_OUTCOME.md).

## Purpose

`acquisition-pipeline-presentation.js` combined release normalization, server-derived action labels, quality evidence, match-card shaping, summary cards, and review details in one 713-line client module. Its only live workflow caller needs normalized releases and summary cards, but retaining all concerns together makes changes difficult to localize and encourages legacy terminology to remain the implementation source.

This phase makes focused Missing Music modules the implementation owners and converts the legacy module into five named ESM compatibility exports.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `missing-music-presentation-utils.js` | Defensive parsing, release-type formatting, and activity extraction |
| `missing-music-release-action-presentation.js` | Server-derived next-action and status-class presentation |
| `missing-music-release-quality-presentation.js` | Quality summary, quality guidance, and quality-fit detail rows |
| `missing-music-match-presentation.js` | Match-card labels, availability, evidence, and transfer-health presentation |
| `missing-music-release-normalization.js` | Release read-model normalization and operational summary cards |
| `missing-music-release-review-presentation.js` | Release-detail review model composed from normalized data |
| `acquisition-pipeline-presentation.js` | Legacy named ESM aliases only |

`useMissingMusicReleaseWorkflow.js` imports the canonical normalization module directly. The legacy facade retains the historical function bindings for any downstream compatibility caller.

## Scope

- Separate each pure presentation responsibility into its own ESM module.
- Preserve all previous release, action, summary, quality, match-card, and review output.
- Preserve legacy function identity through named re-exports.
- Add canonical behavior and legacy-identity tests.

## Explicitly out of scope

- Changing visible labels, keyboard interactions, focus, live regions, routes, polling, or workflow mutation behavior.
- Renaming server routes, request keys, error codes, idempotency scopes, database fields, operation records, or audit/history events.
- Changing release ownership checks, requester/admin visibility, CSRF, sessions, or authorization.
- Removing older recovery and release-progress facades that require separate contract audits.

## Research and rationale

Vue distinguishes stateless utilities from stateful composables and recommends organizing logic by logical concern. Focused pure presentation modules make their sources explicit without adding component state or side effects. MDN documents named re-exports as a standard ESM compatibility mechanism, allowing the legacy boundary to preserve exact imported bindings.

The modules retain existing labels and action semantics rather than creating another competing vocabulary. That follows WCAG 2.2 consistent identification: a repeated action must retain a consistent label and accessible name. The existing component markup continues to determine status-message announcements; this refactor neither creates additional live regions nor changes focus.

The client outputs only server-derived action data. It remains a display layer, not an authorization boundary: user scope, CSRF protection, permissions, idempotency, and retained history remain server enforced.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Focused canonical modules with a narrow legacy facade | Clear ownership, small testable files, preserved caller identity and UI output | Temporary compatibility module remains | Recommended |
| Full cross-layer rename in one pass | Immediate uniformity | Risks server correlation, retries, audit history, and multi-user contracts | Rejected |
| Leave the large module intact | No code movement | Mixed responsibilities and legacy ownership remain | Rejected |

## Recommendation stack

1. Keep canonical Missing Music presentation logic in focused pure ESM modules.
2. Preserve legacy Music Queue and acquisition entry points as named re-export facades only.
3. Treat all server-correlated terminology as stable until a dedicated route, persistence, idempotency, and history migration is approved.
4. Assert both canonical behavior and old-to-new binding identity before broader validation.

## Open PR assessment

The GitHub CLI cannot authenticate in this environment, so it cannot authoritatively enumerate open pull requests. The reachable remote candidate, Dependabot PR #41, was fetched locally as `origin/pr/41` and inspected without merging. Its four direct dependency versions are already present on `main`; applying its stale package files would regress the dependency baseline. It is not applicable to this presentation refactor.

## Acceptance criteria

- No active client workflow imports the legacy acquisition-pipeline module.
- The legacy five-export surface remains exact aliases of canonical implementations.
- Normalization preserves server-derived actions and release-scope data.
- Match review never exposes fallback-quality permission outside `quality_choice_needed`.
- User-visible copy, status-message markup, navigation, request behavior, authorization, and history remain unchanged.
- Focused tests, client lint/build/tests, ESM checks, and full repository validation pass.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
