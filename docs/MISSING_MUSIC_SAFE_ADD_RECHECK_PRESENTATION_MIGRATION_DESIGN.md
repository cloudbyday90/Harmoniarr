# Missing Music Safe-Add Recheck Presentation Migration — Design

## Status

Implemented and validated on 2026-08-28. The companion verification record is [MISSING_MUSIC_SAFE_ADD_RECHECK_PRESENTATION_MIGRATION_OUTCOME.md](./MISSING_MUSIC_SAFE_ADD_RECHECK_PRESENTATION_MIGRATION_OUTCOME.md).

## Purpose

The Settings Media Storage view already uses the canonical Missing Music formatter name, but that formatter is only a facade over `settings-music-queue-safe-add-recheck-presentation.js`. The implementation should move to `settings-missing-music-safe-add-recheck-presentation.js` so its ownership matches the current Missing Music recovery workflow.

This change affects presentation ownership only. It does not change a folder save, send a recheck request, authorize a user, or start a library add.

## Verified boundaries

| Boundary | Existing owner | Migration effect |
| --- | --- | --- |
| Settings save and folder-readiness validation | Settings form and server validation | Unchanged |
| Recheck request | CSRF-backed Missing Music release API | Unchanged |
| Authentication and release ownership | Fresh-session acquisition route and scoped pipeline service | Unchanged |
| Candidate selection, preview, quality gate, and operation run | Import-candidate safe-add recheck service | Unchanged |
| Return destination | Allowlisted Settings recovery handoff | Unchanged |
| Fixed feedback projection | Canonical Missing Music ESM module | Moved |
| Historical import | Music Queue ESM facade | Preserved as a named alias |

The pure formatter sees only a normalized recovery context and the bounded `queued`, `deferred`, or `still_needs_review` outcome. It never receives candidate identifiers, provider data, paths, media-tool diagnostics, or a free-form destination.

## Accessibility and product language

The existing `SettingsRecoveryConfirmation` uses a polite `role="status"` message, a visible heading, and a native router link with a descriptive return label. The migration preserves its exact output and therefore changes no markup, focus behavior, keyboard behavior, or live-region behavior.

“Library add resumed” is retained because the server has queued safe follow-up work; it does not claim that an album was added. The return action remains “Return to Missing Music,” keeping the repeated destination consistently identified.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Canonical Missing Music module plus explicit legacy re-export | Accurate ownership, exact function identity, limited blast radius | Retains a small facade | Recommended |
| Rename all Settings and server recovery identifiers | Removes all legacy terminology | Alters deep-link compatibility and server-correlation contracts outside the presentation scope | Rejected |
| Keep the Music Queue implementation | No file movement | Leaves canonical callers dependent on historical ownership | Rejected |
| Let the client infer recheck outcomes | Fewer server payload fields in theory | Duplicates security-critical policy and can contradict scoped server state | Rejected |

## Recommendation stack

1. Move only the stateless formatter into a canonical Missing Music ESM file.
2. Keep the historical export as an explicit named re-export of the same function binding.
3. Preserve the allowlisted recovery handoff and fixed feedback copy exactly.
4. Test canonical outcomes, legacy identity, scoped route behavior, and the omission of raw diagnostics.
5. Run focused tests, lint, ESM validation, build, client suite, and repository validation before commit.

## Security and multi-user posture

- This formatter is read-only and stateless; it cannot retain one user’s recovery context for another user.
- It cannot mint a route, release identifier, run identifier, or candidate identifier. The return action is derived only from validated allowlisted context.
- The server retains fresh-session, CSRF, user-scope, quality-gate, operation-run, and history/audit authority.
- The bounded feedback intentionally excludes paths, provider details, media-tool diagnostics, candidate metadata, and operation run IDs.

## Open PR assessment

GitHub CLI authentication is unavailable in this environment. The reachable Dependabot PR #41 was fetched locally without merging; its direct dependency versions already match `main`, so it is stale and not applicable.

## Sources

- [Vue: Composables and extracted logic for code organization](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
