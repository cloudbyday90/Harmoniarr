# Missing Music Selection and Mutation Guard Migration — Design

## Status

Implemented and fully validated on 2026-08-27. The companion implementation record is [MISSING_MUSIC_SELECTION_GUARD_MIGRATION_OUTCOME.md](./MISSING_MUSIC_SELECTION_GUARD_MIGRATION_OUTCOME.md).

## Purpose

The prior terminology migration established Missing Music as the client-facing workflow while match-selection feedback and the single-flight release mutation guard still had `music-queue` implementation owners. This phase moves those two cohesive client helpers to canonical Missing Music ESM modules and keeps the legacy modules as explicit named re-export facades.

The change clarifies ownership without altering transport behavior, persisted operational history, or service contracts.

## Scope

- Add `missing-music-match-selection-feedback-presentation.js` as the implementation owner for authoritative match-selection confirmation text.
- Add `missing-music-release-mutation-gate.js` as the implementation owner for the in-memory, per-composable single-flight release-action guard.
- Update the active workflow implementation to import the canonical helpers.
- Retain exact named ESM compatibility exports from both legacy `music-queue` modules.
- Prove compatibility identity and behavior with focused client tests.

## Explicitly out of scope

- Renaming the internal release-transition presentation helper. It remains an internal dependency until its own small migration.
- Moving the `useMusicQueue` implementation behind `useMissingMusicReleaseWorkflow`; that follows after the remaining helpers have canonical ownership.
- Changing API URLs, server errors, stored history, authorization, CSRF handling, request payloads, response shapes, or ownership rules.
- Changing the idempotency scope `acquisition.music-queue.matches.use`; it remains a server-correlation compatibility contract.
- Adding or changing UI layout, focus behavior, live regions, or route labels.

## Design and accessibility rationale

The match-selection helper derives confirmation text only from the server-returned release state. It must not promise that a provider accepted a transfer or that media was acquired. This distinguishes a saved selection from subsequent background work and keeps the operator-facing result accurate.

Existing release-scoped feedback remains the presentation owner for the message role: routine progress and confirmation use `status`; failure uses `alert`. This preserves WCAG 2.2 SC 4.1.3 status-message behavior without moving focus. Canonical Missing Music names also reinforce WCAG 2.2 SC 3.2.4: equivalent functions retain consistent identification while legacy imports remain available for a controlled migration.

The mutation gate is intentionally a client-side usability control, not a security boundary. It prevents a person from dispatching competing actions for two releases through the same workflow instance. Authentication, authorization, CSRF validation, ownership, idempotency, and server-side concurrency safeguards remain authoritative.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Rename the complete workflow now | Removes all legacy names at once | Broadly risks UI, server correlation, retries, and multi-user behavior | Rejected |
| Keep helpers implemented under `music-queue` | No migration work | Canonical ownership remains misleading and prolongs drift | Rejected |
| Move two cohesive helpers, use exact ESM facades | Small review surface, clear ownership, preserves binding identity and behavior | Temporary adapter paths remain | Recommended |

## Open PR assessment

Dependabot PR #41 was fetched locally as `origin/pr/41` and reviewed without merging. The proposed development dependency versions already match `main`, and its branch predates current validation and hardening work. It is stale and provides no applicable change for this phase, so it must not be applied.

## Acceptance criteria

- Missing Music owns the match-selection feedback and mutation-gate implementations.
- The active client workflow imports canonical modules.
- Legacy paths re-export the same named function bindings.
- Match selection remains state-derived, bounded, and does not overstate acquisition progress.
- The mutation guard keeps its one-active-release and release-owner-only semantics.
- Server security and idempotency contracts are byte-for-byte unchanged.
- Focused tests, lint, client tests, and full repository validation pass before commit.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables.html)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
