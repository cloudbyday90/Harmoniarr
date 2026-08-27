# Missing Music Client Terminology Migration — Design

## Status

Implemented and validated on 2026-08-27. The companion record is [MISSING_MUSIC_CLIENT_TERMINOLOGY_MIGRATION_OUTCOME.md](./MISSING_MUSIC_CLIENT_TERMINOLOGY_MIGRATION_OUTCOME.md).

## Purpose

The visible workflow is **Missing Music** for release decisions and **Downloader** for transfer activity. Some reachable client modules still use earlier `music-queue` or `acquisition` names. The first migration phase introduces canonical Missing Music module boundaries for currently active UI callers without altering server endpoints, authorization, stored data, routes, or user history.

This staged approach avoids a high-risk whole-repository rename. It makes the product vocabulary accurate at the current client boundary and uses small ESM aliases while live internal callers migrate. Where the API implementation was moved, the former module path is a re-export facade; where a legacy implementation still has active internal dependencies, the new canonical entry point is a temporary alias to it.

## Scope

This phase creates or adopts canonical client entry points for:

- Missing Music release requests;
- the artist-detail Missing Music workflow composable;
- artist-detail Missing Music progress presentation and component; and
- the Settings safe-library-add recovery message.

The active Artist Detail and Settings callers migrate to these entry points. The old transport URL, idempotency namespace, and server response code remain unchanged because they are compatibility and security boundaries, not product copy.

## Explicitly out of scope

- Changing `/api/v1/acquisition/*` URLs, database fields, server services, event history, or persisted request ownership.
- Removing `music-queue`, `acquisition`, or `activity/queue` legacy URL redirects.
- Renaming server-side correlation fields or idempotency values such as `acquisition.music-queue.matches.use`.
- Changing the Missing Music or Downloader task flow, role checks, focus order, or visual layout.

## Accessibility and product rationale

The previous Artist Detail progress panel exposed labels such as “Music Queue” while its action led to the Missing Music workflow. The canonical presentation now identifies the task consistently as Missing Music and links directly to canonical route names. This follows WCAG guidance that repeated navigation remains predictable and that components with the same functionality use consistent identification.

No interactive controls are added or removed. Semantics, live-status behavior, keyboard order, and focus treatment remain unchanged. The implementation changes terminology and import boundaries only.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Rename every client/server/API identifier now | Uniform names immediately | High regression risk across authorization, operation history, storage, routes, and diagnostics | Rejected |
| Leave active legacy names indefinitely | No implementation effort | Product terminology continues to drift and future work cannot see the correct module boundary | Rejected |
| Add canonical ESM boundaries, migrate active callers, retain legacy re-export adapters | Small, testable change; preserves backend and saved-link compatibility | Temporary duplicate paths require a later cleanup phase | Recommended |

## Security and multi-user constraints

Release IDs and user ownership remain server-scoped. The client continues to send only the existing bounded request payloads and CSRF-protected mutations. Compatibility adapters may rename exported JavaScript functions, but must not change request URLs, idempotency keys, authorization assumptions, or response handling.

## Open PR assessment

Open Dependabot PR [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) was fetched and reviewed locally, without merging. It proposes Node `26.7.0-alpine`, but the official Node release page identifies Node 26 as **Current** and Node 24 as the **LTS** line. The current repository intentionally constrains Node to the 24 LTS major. The PR is also stale and diverges across the repository, so it is not safe or applicable to this focused change.

## Acceptance criteria

- Active Artist Detail and Settings modules import canonical Missing Music interfaces.
- The visible Artist Detail progress panel uses Missing Music terminology and canonical Missing Music routes.
- Existing legacy modules remain ESM adapters with equivalent exports where retained.
- No request URL, idempotency key, authorization check, route compatibility alias, or focus behavior changes.
- Focused tests and complete validation pass.

## Sources

- [Vue: Composables](https://vuejs.org/guide/reusability/composables.html)
- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [W3C WCAG 2.2: Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
