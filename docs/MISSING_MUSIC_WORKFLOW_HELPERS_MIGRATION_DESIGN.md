# Missing Music Workflow Helpers Migration — Design

## Status

Implemented and validated on 2026-08-27. The companion record is [MISSING_MUSIC_WORKFLOW_HELPERS_MIGRATION_OUTCOME.md](./MISSING_MUSIC_WORKFLOW_HELPERS_MIGRATION_OUTCOME.md).

## Purpose

The prior client-terminology phase established canonical Missing Music entry points, but the progress-state and short-lived action-feedback implementations still live in `music-queue` modules. This phase makes Missing Music the implementation owner for those two cohesive helper modules, while legacy paths become explicit ESM re-export facades.

The change is deliberately internal. It does not rename server APIs, database fields, persisted history, routes, or idempotency namespaces.

## Scope

- Move progress-state constants and predicates into `missing-music-progress-state.js`.
- Move release-scoped feedback normalization and presentation into `missing-music-action-feedback-presentation.js`.
- Update the active workflow and progress-presentation implementation to import the canonical helpers.
- Keep `music-queue-progress-state.js` and `music-queue-action-feedback-presentation.js` as named ESM compatibility re-exports.
- Move focused tests to canonical names and prove old and new exports retain object/function identity.

## Explicitly out of scope

- Match-selection feedback, recovery helpers, mutation gates, transport APIs, or server workflows.
- Request URLs, CSRF handling, idempotency values, user ownership checks, or response shapes.
- UI layout, focus order, interaction behavior, and route aliases.

## Accessibility and security rationale

The feedback helper produces release-scoped messages with a programmatic role: `status` for routine progress/success and `alert` for errors. WCAG 2.2 SC 4.1.3 requires status messages to be programmatically determinable without moving focus. The migration must preserve those roles and the bounded, selected-release-only behavior exactly.

Using Missing Music names for the same user-visible workflow also supports WCAG 2.2 SC 3.2.4: repeating functionality should be identified consistently. No new live region, alert, focus movement, or user data is introduced.

Multi-user safeguards stay server-owned. The client feedback remains keyed only to the current release ID, avoids provider/private diagnostic data, and does not expand request payloads.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Whole-workflow rename | Removes legacy names immediately | High risk to server correlation, historical records, retry keys, and active behavior | Rejected |
| Leave implementations at legacy paths | No code change | Canonical boundary remains misleading and future work drifts | Rejected |
| Move one cohesive helper layer and retain ESM re-exports | Clear ownership, export-identity compatibility, small reviewable diff | Temporary adapter paths remain | Recommended |

## Open PR assessment

Dependabot PR #41 was fetched locally as `origin/pr/41` and reviewed without merging. Its direct development dependency versions are already present on `main`, while its base predates current validation and dependency-hardening work. Applying it would add no current package benefit and would be an unsafe stale-branch operation, so it is intentionally not applied.

## Acceptance criteria

- Canonical Missing Music modules own progress-state and action-feedback implementations.
- Active callers import the canonical helpers.
- Legacy modules are ESM re-export facades with equivalent named exports.
- Feedback keeps release scoping, output limits, and `status`/`alert` semantics.
- No transport, authorization, route, or persisted-data behavior changes.
- Focused tests, client lint/build/tests, and full repository validation pass.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables.html)
- [MDN: `export` and re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
- [W3C technique ARIA22: `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
