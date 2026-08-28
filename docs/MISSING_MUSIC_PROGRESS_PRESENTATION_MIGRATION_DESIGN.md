# Missing Music Progress Presentation Migration — Design

## Status

Implemented and awaiting final repository validation on 2026-08-28. The companion record is [MISSING_MUSIC_PROGRESS_PRESENTATION_MIGRATION_OUTCOME.md](./MISSING_MUSIC_PROGRESS_PRESENTATION_MIGRATION_OUTCOME.md).

## Purpose

The visible Home and Missing Music progress strip already imports the canonical `missing-music-progress-presentation.js` entry point. Before this change, however, that file only renamed an implementation still owned by `music-queue-progress-presentation.js`. This inverted ownership makes future work prone to reintroducing legacy terminology.

This phase makes `missing-music-progress-presentation.js` the implementation owner and retains `music-queue-progress-presentation.js` as a narrow, named ESM compatibility facade.

## Scope

- Move the pure `buildMissingMusicProgressStrip` implementation to the canonical module.
- Preserve the legacy `buildMusicQueueProgressStrip` export as the same function binding.
- Rename the direct unit-test file to the canonical product term.
- Preserve every returned progress row, navigation destination, summary string, sort order, limit, and status tone.

## Explicitly out of scope

- Changing visible labels, progress-strip markup, live-region roles, focus behavior, or action semantics.
- Renaming historical request keys, server routes, error codes, idempotency scopes, audit events, operation records, or database fields.
- Moving the broader `acquisition-pipeline-presentation.js` module, which combines several release-presentation concerns and needs its own acceptance criteria.
- Changing authorization, requester/admin visibility, CSRF validation, session handling, or user history.

## Research and rationale

Vue describes composables as small functions that encapsulate reusable stateful logic; corresponding stateless presentation utilities should likewise have one clear, logical owner. Named ESM re-exports preserve an explicit compatibility boundary without making a deprecated module the source of truth.

The progress strip includes a polite status message in its existing component. WCAG 2.2 requires consistently identifying controls with the same function, and WCAG status-message guidance requires programmatically determinable status feedback without forcing focus changes. This refactor changes no presentation output or markup: the same progress summary and action labels remain available to all callers.

No authorization or validation decision occurs in this helper. Keeping it pure avoids adding a client-side security boundary; the server remains responsible for user scope, CSRF, permissions, idempotency, and history.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Make Missing Music the owner; retain a named legacy ESM facade | Clear ownership, preserves import compatibility and function identity, no UI or transport behavior change | Temporary facade remains | Recommended |
| Rename all client, server, transport, and persistence terms at once | Uniform terminology immediately | High risk to correlation, retries, audit history, and multi-user contracts | Rejected |
| Leave the canonical module as an adapter | No immediate code movement | Misleading ownership and recurring terminology drift | Rejected |

## Recommendation stack

1. Use canonical Missing Music modules as the implementation owners for safe, client-only presentation logic.
2. Keep narrowly scoped, named ESM Music Queue re-exports until callers can be deliberately retired.
3. Keep server-correlated terminology intact unless a dedicated end-to-end migration proves compatibility for retries, authorization, and history.
4. Validate function identity, presentation behavior, lint, ESM boundaries, full client tests, and the repository validation gate before committing.

## Open PR assessment

The GitHub CLI cannot authenticate in this environment, so it cannot authoritatively enumerate open pull requests. The reachable remote candidate, Dependabot PR #41, was fetched locally as `origin/pr/41` and inspected without merging. Its four direct dependency updates are already present on `main`; applying its stale package files would regress the current dependency baseline. It is not applicable to this change.

## Acceptance criteria

- `missing-music-progress-presentation.js` owns the implementation.
- The legacy export remains an exact alias of the canonical function.
- Current rendered behavior and accessible status-message behavior remain unchanged.
- No server, transport, user scope, or history behavior changes.
- Focused tests, client lint/build/tests, ESM checks, and full repository validation pass.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
