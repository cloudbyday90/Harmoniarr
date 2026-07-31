# Music Queue Release-Scoped Library-Add Diagnostics Design

Status: **Implemented.**

Date: 2026-07-31.

## 1. Problem

Music Queue correctly explains a safe library-add stop at the release level,
but its previous `Advanced diagnostics` link opened the global library-add
worklist. That worklist only shows candidates still marked `import_pending`.
It could not explain a completed safety stop after the apply worker had moved a
candidate to a terminal state, and it mixed unrelated releases and worker runs
into the recovery flow.

The intended secondary path is:

`Music Queue release -> Advanced diagnostics -> latest safe add outcome for that release -> optional match diagnostics`

## 2. Official Sources Reviewed

The following official guidance was rechecked on 2026-07-31 for the requested
June 2026 design baseline.

| Source | Design input |
| --- | --- |
| [OWASP API Security: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) | A wanted-release ID in a URL must be authorized server-side on every read. The client-provided ID is navigation state, never permission. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Apply deny-by-default, verify authorization on every request, and test object-level access boundaries. |
| [Vue Router: Programmatic Navigation](https://router.vuejs.org/guide/essentials/navigation) | Named-route navigation with an explicit query parameter preserves a precise, reloadable handoff without adding hidden client state. |
| [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | The handoff uses ordinary links and buttons so focus stays visible and the browser retains predictable navigation semantics. |
| [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | The scoped page puts the current outcome and its next action before the compact history, matching the recovery task order. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the global import-pending worklist | No new API or UI. | Cannot show terminal apply outcomes and makes unrelated work the default diagnostic context. | Reject. |
| Filter the existing candidate list in the browser | Small client change. | Treats client state as an authority boundary, retains raw candidate data, and loses historical apply outcomes. | Reject. |
| Add a release-scoped server read over durable apply items | Opens the relevant latest outcome, survives status transitions, and supports object-level authorization. | Adds a small repository, service, and endpoint. | Adopt. |
| Expose raw paths, source users, status messages, and run IDs in the scoped summary | Gives immediate detail. | Leaks implementation and potentially sensitive filesystem/provider information into a broad secondary page. | Reject. |

## 4. Final Recommendation Stack

### Server Contract

- `GET /api/v1/import-candidates/release-add-diagnostics` requires an
  administrator session.
- The endpoint accepts `wantedReleaseId` and an optional bounded `limit`.
- The service first resolves that ID through
  `library_wanted_releases` for the signed-in `app_user_id`. Missing,
  malformed, and cross-operator IDs all produce the same generic 404.
- It reads the newest durable apply item per matching candidate, ordered by the
  latest safe outcome. It matches both the primary and shared
  `wantedReleaseIds` context retained in the apply snapshot or normalized
  candidate payload.
- It returns only release identity, a friendly allow-listed outcome
  presentation, timestamp, and opaque candidate ID for the explicit next
  diagnostic link. It does not return paths, provider data, usernames, run
  IDs, snapshots, status messages, quality-gate data, or error text.

### Shared Presentation

- `acquisition-add-blocker-repair.js` now owns the bounded blocker copy used
  by both Music Queue status projection and this diagnostics endpoint.
- The common categories are `add_failed`, `library_collision`,
  `media_verification`, `source_path_unavailable`, and `unsafe_add_plan`.
- This prevents a Music Queue status and its diagnostics page from describing
  the same safe stop differently.

### User Experience

- `Advanced diagnostics` now carries the selected `wantedReleaseId` into the
  existing Library-add diagnostics route.
- A scoped page leads with the newest outcome, its timestamp, the safe next
  step, a relevant Settings action when applicable, and one optional
  `Open match diagnostics` action.
- A compact history shows only other latest outcomes for the same release.
- The unscoped route retains the existing global `import_pending` worklist for
  deliberate advanced troubleshooting. It is not part of the normal Music
  Queue journey.

### Security And Data Minimization

- Query values are parameterized; malformed identifiers are rejected before a
  database query.
- The repository retains no status-message selection, and the service never
  serializes `applySnapshot` data to the client.
- The direct Match diagnostics link remains a separate admin-authorized read,
  preserving its existing candidate-level authorization boundary.
- There is no schema change: the implementation uses the already durable
  `musicQueueContext` stored in candidate/apply evidence. The migration and
  schema snapshot therefore remain current.

## 5. Validation

Focused validation passed on 2026-07-31:

- repository test confirms deterministic latest-per-candidate selection,
  primary/shared wanted-release context matching, parameterized limits, and no
  `status_message` projection;
- service test confirms a bounded, redacted response and generic 404 behavior
  for malformed and non-owned release IDs;
- route test confirms administrator enforcement and exact scoped arguments;
- client contract and production client build passed;
- Playwright verifies Music Queue opens the release-specific diagnostic route,
  shows the latest quality stop first, and keeps source/path fields out of the
  page.

## 6. Outcome

Advanced library-add diagnostics are now release scoped. A user recovering a
safe stop no longer has to reconstruct it from a global candidate list or an
operation run. The normal Music Queue flow stays release centred; low-level
file details require an intentional second handoff.

## 7. Follow-Up

The next high-value item is **release-scoped advanced-diagnostics reload and
cross-operator acceptance coverage**. It should use two isolated operator
sessions to prove a copied URL returns the same selected release after reload
for its owner, returns a generic 404 for another operator, and never falls
back to an unscoped library-add worklist.
