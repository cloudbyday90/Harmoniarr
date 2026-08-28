# Missing Music Provider Recovery Visibility Migration — Design

## Status

Implemented and awaiting final repository validation on 2026-08-28. The companion record is [MISSING_MUSIC_PROVIDER_RECOVERY_VISIBILITY_MIGRATION_OUTCOME.md](./MISSING_MUSIC_PROVIDER_RECOVERY_VISIBILITY_MIGRATION_OUTCOME.md).

## Purpose

`music-queue-provider-recovery-visibility-presentation.js` is a deterministic client formatter for the result of returning from a successful Soulseek connection repair. It also owns one fixed query marker, `provider_ready`, used only to let the return destination display the already-authorized, post-repair state.

The active Settings recovery presentation already belongs to the Missing Music workflow, so its implementation should import a canonical Missing Music module. This phase moves the pure formatter and fixed marker to `missing-music-provider-recovery-visibility-presentation.js`, retaining the historical Music Queue module as a named ESM facade.

## Scope and module boundaries

| Module | Responsibility |
| --- | --- |
| `missing-music-provider-recovery-visibility-presentation.js` | Fixed `provider_ready` marker validation/removal and safe provider-ready visibility projection. |
| `settings-provider-recovery-presentation.js` | Builds the Settings confirmation after its existing connection and setup checks; it imports the canonical marker. |
| `settings-recovery-handoff.js` | Independently allowlists return destinations and bounded release identifiers. It remains the navigation boundary. |
| `music-queue-provider-recovery-visibility-presentation.js` | Legacy named ESM aliases only. |

## Security and multi-user boundary

This migration does not widen navigation or access. The canonical module accepts no URL, route name, provider address, secret, or authorization input. It only recognizes a fixed equality marker and removes one known query key. It retains server ordering of releases rather than creating client-side scheduling policy.

Settings return destinations remain validated by `settings-recovery-handoff.js`: only fixed named destinations and bounded release identifiers are accepted. The server still enforces authentication, administrator access to Settings, requester scope, release visibility, CSRF, idempotency, provider state, and audit/history retention. Provider-ready text is a display result, never permission to start a search or download.

## Accessibility and product language

The migration retains current visible labels, actions, and status-message markup. WCAG 2.2 requires the same function to remain consistently identified across pages, so this ownership change must not create a competing return-action name. The existing native Settings return link retains its clear destination; no new control, focus move, or live region is introduced.

The module remains a stateless formatter, not a Vue composable or singleton. It returns only a bounded read model that downstream components render through their existing accessible markup.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Canonical Missing Music module with legacy named re-exports | Clear current ownership, stable marker value, exact caller compatibility, small testable boundary | Temporary facade remains | Recommended |
| Rename all Settings recovery contexts and marker values | Uniform terminology immediately | Risks deep-link compatibility and correlation with retained legacy route contexts | Rejected |
| Keep the legacy module as owner | No file movement | Leaves Settings dependent on legacy terminology despite canonical Missing Music flow | Rejected |

## Recommendation stack

1. Keep provider-ready visibility and its fixed marker in one small Missing Music ESM module.
2. Preserve the `provider_ready` value and legacy bindings with named re-exports.
3. Continue using the separate allowlisted Settings handoff for navigation; do not accept free-form return URLs.
4. Preserve server ordering, server authorization, and existing accessible UI semantics.
5. Verify canonical output and every legacy alias before full validation.

## Open PR assessment

The GitHub CLI cannot authenticate in this environment and cannot authoritatively list open pull requests. The reachable Dependabot PR #41 was fetched locally as `origin/pr/41` and inspected without merging. Its direct dependency versions are already present on `main`; applying its stale package files would regress the dependency baseline. It is not applicable to this migration.

## Acceptance criteria

- The canonical Missing Music module owns provider-ready formatting and the fixed marker.
- The old module exports the same constant value and function bindings.
- Settings recovery imports the canonical marker directly.
- Recovery visibility preserves API order and does not create client scheduling policy.
- No route, request, authentication, authorization, CSRF, multi-user scope, audit/history, copy, focus, or live-region behavior changes.
- Focused tests, lint/ESM/build checks, full client tests, and repository validation pass.

## Sources

- [Vue: Composables and extracting logic for code organization](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
