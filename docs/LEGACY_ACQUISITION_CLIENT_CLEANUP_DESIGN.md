# Legacy Acquisition Client Cleanup — Design

## Status

Implemented on 2026-08-27. The companion outcome record is [LEGACY_ACQUISITION_CLIENT_CLEANUP_OUTCOME.md](./LEGACY_ACQUISITION_CLIENT_CLEANUP_OUTCOME.md).

## Purpose

Harmoniarr now presents the release decision workflow as **Missing Music**, followed by **Downloader** for transfer progress. Earlier client-only Music Queue and Acquisition workspaces are no longer reachable from the application router or primary navigation. Retaining their isolated views, composables, components, presentation helpers, and direct unit tests adds maintenance surface without providing a user-facing path.

This cleanup removes only the demonstrably orphaned implementation while preserving the routes and utilities that existing users, bookmarks, and current screens still rely on.

## Evidence and boundary

The client import graph is rooted at `src/client/main.js`, with static and dynamic relative imports resolved through the current router. The graph shows that `MusicQueueView.vue`, `AcquisitionView.vue`, and `AcquisitionWorkspaceView.vue` are not router targets and are not imported by another reachable module.

The cleanup removes:

- 31 unreachable legacy client source modules: the three retired workspace views and the components, composables, and presentation helpers used only by those views.
- 22 direct unit and source-contract tests for those modules.

The cleanup deliberately retains:

- `missing-music-legacy-route-redirect.js` and the redirect-only `music-queue`, `acquisition`, and `activity/queue` route aliases. A saved legacy URL continues to land on the appropriate Missing Music or Downloader screen with its query string and fragment preserved.
- Reachable shared functionality whose file names predate the product terminology: `useMusicQueue`, artist progress, activity diagnostics, settings recheck code, and the Downloader handoff helpers.
- All server routes, authorization behavior, user scopes, history, current Missing Music/Downloader components, and browser-level redirect coverage.

This is intentionally a dependency cleanup, not a product-flow rewrite or an API change.

## Accessibility and usability rationale

The visible navigation already has one clear location for each task: Missing Music for selecting or confirming a release, and Downloader for monitoring transfers. Keeping unused page implementations cannot improve that navigation and makes future changes harder to reason about.

Redirect-only route records preserve older entry points without rendering a second, competing UI. Vue Router supports redirects to named routes, and the target route supplies the rendered view. The aliases therefore provide continuity without duplicating navigation choices.

The retained primary navigation keeps a stable order and labels across screens, supporting WCAG consistent-navigation expectations. No focusable UI is removed from the visible application shell in this change, so keyboard order and focus behavior remain unchanged.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Delete all code with `music-queue` or `acquisition` in its name | Fastest apparent cleanup | Breaks reachable artist, activity, settings, and Downloader behavior; risks legacy URLs | Rejected |
| Retain every retired workspace module | No immediate deletion risk | Continues dead code, stale tests, and misleading architecture | Rejected |
| Remove only graph-proven orphaned modules and retain adapters/redirects | Reduces debt while retaining compatibility and user flows | Leaves some legacy internal names for a later migration | Recommended and implemented |

## Security and multi-user constraints

No authorization or server-side data access is modified. URL redirects must continue to route through existing destination views, which enforce current actor-scoped behavior. Cleanup must not replace server-derived ownership, request history, or administrative filtering with client-side assumptions.

## Open PR assessment

Open Dependabot PR [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) proposes `docker/build-push-action` v7.1 to v7.2. It was reviewed locally but not applied: the current workflow already pins v7.3.0, and the stale PR diverges across 1,654 files. Applying it would be a regression and an unrelated merge risk.

## Acceptance criteria

- Removed modules have no remaining client import or router reference.
- Legacy aliases keep routing to Missing Music or Downloader, including query and fragment preservation.
- The client build and validation suite pass.
- The diff contains no API, authorization, schema, or navigation-label change beyond removal of unreachable code.

## Sources

- [Vue Router: Redirect and Alias](https://router.vuejs.org/guide/essentials/redirect-and-alias.html)
- [W3C WCAG 2.2: Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
- [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
