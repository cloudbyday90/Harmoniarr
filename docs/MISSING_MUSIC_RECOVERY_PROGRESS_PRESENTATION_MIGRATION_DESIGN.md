# Missing Music Recovery and Progress Presentation Migration — Design

## Status

Implemented and awaiting final repository validation on 2026-08-28. The companion record is [MISSING_MUSIC_RECOVERY_PROGRESS_PRESENTATION_MIGRATION_OUTCOME.md](./MISSING_MUSIC_RECOVERY_PROGRESS_PRESENTATION_MIGRATION_OUTCOME.md).

## Purpose

The Missing Music workflow was already the implementation owner for release normalization and detail review, but each still imported two legacy-named modules:

- `music-queue-recovery-presentation.js`
- `music-queue-release-progress-presentation.js`

Both modules are deterministic, browser-independent projections from an already-authorized release read model. This phase moves their implementations into focused Missing Music ESM modules and retains the old import paths as exact named-export compatibility facades.

## Scope and module boundaries

| Module | Responsibility |
| --- | --- |
| `missing-music-release-recovery-presentation.js` | Converts server status codes into recovery guidance and the one available retry label. |
| `missing-music-release-progress-presentation.js` | Converts server status, match evidence, and confirmed transfer evidence into the ordered Search → Choose match → Download → Add to library progress model. |
| `missing-music-release-normalization.js` | Calls canonical recovery presentation while retaining the existing normalized read-model shape. |
| `missing-music-release-review-presentation.js` | Calls canonical progress presentation while retaining the existing review-model shape. |
| `music-queue-*-presentation.js` | Named ESM re-export facades for compatibility callers only. |

## Security boundary

The modules do not issue requests, create work, choose a match, change ownership, or decide permissions. They display server-derived status and evidence only. The server continues to enforce requester scope, administrator visibility, CSRF, authorization, idempotency, audit history, and operation history.

Status codes remain stable because they correlate with persisted operations and recovery behavior. The migration changes client implementation ownership, not routes, mutation contracts, event history, or persistence.

## Accessibility and product-language rationale

The four steps and their action labels are retained exactly. WCAG 2.2 Success Criterion 3.2.4 requires repeated functions to be identified consistently; relocating their formatter must not create alternate labels or accessible names. The existing component markup remains responsible for any status-message semantics under WCAG 2.2 Success Criterion 4.1.3. This phase makes no markup, focus, or live-region change, avoiding an unnecessarily chatty announcement.

Vue distinguishes pure stateless formatting functions from stateful composables. These modules remain pure functions rather than adding reactive state or component instances. Focused named ESM exports keep dependency ownership explicit, while MDN documents named re-exports as the standard way to retain an import-compatible facade.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Canonical Missing Music modules plus legacy named re-exports | Clear ownership, small testable units, no caller breakage, no UI/authorization change | Temporary facades remain | Recommended |
| Rename every client and server status in one pass | Uniform terminology immediately | Breaks persisted-operation, audit, retry, and compatibility correlations | Rejected |
| Retain legacy modules as implementation owners | No code movement | Leaves new workflow dependent on old terminology and obscures boundaries | Rejected |

## Recommendation stack

1. Keep recovery and progress as pure, narrowly scoped Missing Music ESM modules.
2. Retain exact legacy bindings through named re-export facades until compatibility retirement is separately approved.
3. Preserve server-correlated status codes, labels, and all user/administrator history semantics.
4. Test canonical behavior and legacy binding identity, then run focused and full repository validation.

## Open PR assessment

The GitHub CLI is unauthenticated in this environment and cannot authoritatively list open pull requests. The reachable remote candidate, Dependabot PR #41, was fetched locally as `origin/pr/41` and inspected without merging. Its four direct dependency versions are already present on `main`; applying its package files would regress the current dependency baseline. It is not applicable to this migration.

## Acceptance criteria

- Canonical Missing Music modules own recovery and progress behavior.
- Legacy exports remain the same JavaScript function bindings as their canonical counterparts.
- Normalization and review modules no longer import the two legacy implementation modules.
- Recovery guidance, progress order, labels, UI markup, focus, and live-region behavior remain unchanged.
- No API, permission, ownership, CSRF, idempotency, or history behavior changes.
- Focused tests, ESM/lint/build checks, client suite, and repository validation pass.

## Sources

- [Vue: Composables and extracting logic for code organization](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
