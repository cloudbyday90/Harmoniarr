# Missing Music Provider Repair Presentation Migration — Design

## Status

Implemented and validated on 2026-08-28. The companion verification record is [MISSING_MUSIC_PROVIDER_REPAIR_PRESENTATION_MIGRATION_OUTCOME.md](./MISSING_MUSIC_PROVIDER_REPAIR_PRESENTATION_MIGRATION_OUTCOME.md).

## Design outcome

The historical `music-queue-provider-repair-presentation.js` module is a deterministic client formatter, not an operational service. It accepts reduced setup and health state, maps it to fixed application copy, and returns the fixed `settings-connections` route. Its sole production caller is the Settings recovery confirmation.

The canonical Missing Music workflow should own this display projection. Create `missing-music-provider-repair-presentation.js`, migrate the Settings import to its canonical function name, and retain the historical module as explicit named ESM re-exports. The aliases must retain the same function bindings.

## Boundaries

| Concern | Owner | Reason |
| --- | --- | --- |
| Bounded repair wording and provider-dependent-work predicate | Canonical Missing Music presentation module | Stateless, direct, testable client read model. |
| Post-save result composition | Settings recovery presentation | Existing Settings-only confirmation boundary. |
| Setup, connection tests, queueing, and downloads | Existing server workflows | Client presentation must not gain operational authority. |
| Settings authorization | Existing Settings server route | A notice cannot grant administrator access. |
| Legacy imports | Historical Music Queue ESM facade | A stable incremental migration boundary. |

## Security, accessibility, and multi-user posture

- Preserve diagnostic suppression: raw provider messages and codes can contain deployment addresses or secret-related information, so the formatter emits only fixed copy and application codes.
- Do not accept or return a provider endpoint, API key, filesystem path, secret metadata, free-form route, or free-form return URL.
- The client is stateless. Authentication, administrator authorization, requester scope, CSRF, idempotency, queue ordering, download execution, and retained history remain server-controlled.
- Preserve the existing titles, descriptions, labels, route destination, markup, focus behavior, and live-region treatment. WCAG consistent identification requires repeated functions to use predictable names; WCAG link-purpose guidance supports the existing descriptive Settings action.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Canonical Missing Music module plus legacy named re-exports | Accurate ownership, exact compatibility, small and testable | Keeps a temporary facade | Recommended |
| Rename every import and export immediately | Removes legacy names | Breaks compatibility and enlarges the review surface | Rejected |
| Retain historical ownership | No code movement | Continues misleading workflow ownership | Rejected |
| Put provider controls in Missing Music | Fewer clicks in theory | Duplicates privileged Settings and blurs authority | Rejected |

## Recommendation stack

1. Move only the stateless read model to a small canonical ESM module.
2. Preserve legacy bindings with explicit named re-exports.
3. Migrate the Settings composition import to the canonical module.
4. Keep all fixed copy and suppression behavior byte-for-byte where possible.
5. Cover canonical behavior, legacy binding identity, and secret-safe output; run focused and full validation.

## Open PR assessment

Dependabot PR #41 was fetched locally and inspected without merging. Its `@vue/language-server`, ESLint, and `globals` versions already match `main`; applying it would provide no update and could regress the current baseline. It is not applicable to this migration.

## Sources

- [Vue: Composables and extracted logic for code organization](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
