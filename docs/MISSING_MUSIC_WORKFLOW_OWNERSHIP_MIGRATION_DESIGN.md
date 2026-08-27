# Missing Music Workflow Ownership Migration — Design

## Status

Implemented and fully validated on 2026-08-27. The companion record is [MISSING_MUSIC_WORKFLOW_OWNERSHIP_MIGRATION_OUTCOME.md](./MISSING_MUSIC_WORKFLOW_OWNERSHIP_MIGRATION_OUTCOME.md).

## Purpose

The Missing Music route already used a canonical composable entry point, but that file was an adapter while `useMusicQueue.js` still owned the workflow implementation. The release-transition helper had the same inverted ownership. This phase completes the client-side terminology boundary:

- `useMissingMusicReleaseWorkflow.js` owns the stateful workflow.
- `missing-music-release-transition-presentation.js` owns the automatic-handoff presentation.
- Legacy Music Queue files become exact named ESM re-export facades.

The code moves as an internal client refactor. It does not alter routes, API payloads, database state, operator/requester visibility, audit history, or downloader behavior.

## Scope

- Move the release-transition implementation to its canonical Missing Music module and retain the legacy transition export.
- Make `useMissingMusicReleaseWorkflow` the actual Vue Composition API implementation.
- Preserve `useMusicQueue`, `hasActiveMusicQueueProgress`, and `MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES` as compatibility exports.
- Update the selection-feedback helper to use the canonical transition helper.
- Add direct transition behavior coverage and prove legacy-to-canonical function identity.

## Explicitly out of scope

- Renaming established internal request-option keys, server error codes, transport routes, or the idempotency scope `acquisition.music-queue.matches.use`.
- Changing polling cadence, request timing, release-action availability, focus behavior, visible labels, or live-region roles.
- Removing legacy facades or changing historical Music Queue references in audit, operation, and server code.
- Any schema, permission, CSRF, session, or multi-user behavior change.

## Design, accessibility, and security rationale

Vue recommends composables as small functions that encapsulate stateful logic and can be organized around logical concerns. Making the canonical entry point the owner makes the source of client workflow state explicit while retaining a narrow, testable compatibility boundary.

The automatic-handoff helper still returns copy only for authoritative automatic states; unknown and attention states return `null` rather than implying progress. Existing feedback preserves routine `status` messages and error `alert` messages without moving focus, which keeps WCAG status-message behavior intact. Identical legacy and canonical exports preserve the same function and accessible behavior as callers migrate, supporting consistent identification.

No client helper is treated as an authorization boundary. The refactor leaves user scope, CSRF protection, server-side idempotency, conflict detection, and audit history unchanged. In particular, the retained idempotency scope is deliberate compatibility for in-flight/retry correlation.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Rewrite options, API names, and server correlation in one pass | Terminology becomes uniform immediately | High risk to retries, integration contracts, multi-user scope, and history | Rejected |
| Leave canonical files as adapters | Lowest short-term change | Ownership remains misleading; future changes keep drifting to legacy modules | Rejected |
| Move implementation ownership and retain named ESM facades | Clear canonical boundary, function identity compatibility, no service-contract change | Temporary legacy adapters remain | Recommended |

## Open PR assessment

Dependabot PR #41 was fetched locally as `origin/pr/41` and reviewed without merging. Its dependency changes are already present on `main`, and the branch is stale relative to the current validation and security baseline. It is not applicable to this migration and must not be applied.

## Acceptance criteria

- Missing Music owns the transition and workflow implementations.
- Legacy Music Queue entry points are explicit ESM re-exports with identical function/object bindings.
- Canonical selection feedback uses the canonical transition helper.
- Automatic transition messages remain state-derived; unknown states do not promise an action.
- Idempotency, client release scoping, server authorization, CSRF, and user history are unchanged.
- Focused tests, client lint/build/tests, and full repository validation pass before commit.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables.html)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
