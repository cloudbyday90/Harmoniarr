# Music Queue Phase 1 Read Model Design

Status: **Phase 1 complete.**

Date: 2026-06-28.

This document records the Phase 1 implementation outcome for
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md).
Phase 1 creates the read-only Music Queue foundation. It does not yet replace
the full candidate workbench or change download/import automation.

---

## Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| Express routing guide: https://expressjs.com/en/guide/routing.html | Express routes should remain thin HTTP adapters over services. | Added `acquisition-routes.js` as a thin authenticated read adapter. |
| Express error handling guide: https://expressjs.com/en/guide/error-handling.html | Async route failures should flow through centralized error handling. | Used the existing `asyncRoute` pattern and service-thrown API errors. |
| Vue Router lazy loading guide: https://router.vuejs.org/guide/advanced/lazy-loading.html | Route components can be split and loaded only when visited. | Added `MusicQueueView.vue` as a lazy route. |
| Vue composables guide: https://vuejs.org/guide/reusability/composables.html | Stateful async logic should be reusable and isolated from views. | Added `useMusicQueue.js` on top of the existing `useAsyncResource` pattern. |
| OWASP API Security API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Object-level reads must be scoped to the authenticated user. | Music Queue reads require session auth and pass `appUserId` into the read model. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Logs and activity evidence should avoid sensitive payload leakage. | Phase 1 projects bounded summary evidence only; raw provider payloads stay out of the Music Queue API. |

---

## Recommendations Applied

1. Add a dedicated internal `src/server/acquisition/` module boundary.
2. Keep Phase 1 read-only so no download or library-add behavior changes before
   the new status contract is visible.
3. Use existing wanted-release evidence instead of duplicating SQL.
4. Keep `Music Queue` as the user-facing route and title, while retaining
   `acquisition` as an internal backend namespace.
5. Surface release-centered statuses and quality decisions, not raw candidate
   IDs or provider responses.
6. Add top-level navigation to make the new workflow discoverable.

---

## Pros And Cons

| Decision | Pros | Cons |
| --- | --- | --- |
| Reuse the wanted-release read model in Phase 1 | Low regression risk, no migration, immediate compatibility with existing discovery/candidate summaries. | Some deeper transfer/import-preview evidence remains deferred to later phases. |
| Add a top-level Music Queue route now | Users can orient around the new workflow immediately. | The page is still a skeleton until Phase 2 replaces the old candidate-first experience. |
| Keep Import Review intact | Avoids breaking diagnostics and existing browser coverage. | Two surfaces temporarily exist for the same underlying pipeline. |
| Implement pure status and quality services first | Easy to test and reuse when automation changes begin. | Does not itself make downloads/imports automatic. |

---

## Final Recommendation Stack

### Backend

- `src/server/acquisition/acquisition-quality-policy-service.js`
- `src/server/acquisition/acquisition-pipeline-status-service.js`
- `src/server/acquisition/acquisition-pipeline-store.js`
- `src/server/acquisition/acquisition-pipeline-service.js`
- `src/server/acquisition/acquisition-module.js`
- `src/server/routes/acquisition-routes.js`
- `GET /api/v1/acquisition/releases`
- `GET /api/v1/acquisition/releases/:wantedReleaseId`

### Client

- `src/client/lib/acquisition-api.js`
- `src/client/lib/acquisition-quality-presentation.js`
- `src/client/lib/acquisition-pipeline-presentation.js`
- `src/client/composables/useMusicQueue.js`
- `src/client/views/MusicQueueView.vue`
- `/app/music-queue`

### Security

- Authenticated reads only.
- Current `appUserId` is passed into the read model.
- Raw Soulseek payloads, provider credentials, API keys, and filesystem secrets
  are not exposed by the Music Queue API.
- Phase 1 actions are read-only, so CSRF is not needed for these endpoints.

---

## Outcome

Phase 1 landed the modular read-only foundation:

- release-centered Music Queue rows
- status projection from wanted release, discovery, selection-readiness, setup,
  quality, and download execution summary evidence
- quality profile evaluation for lossless archive, high quality, and any
  available profiles
- authenticated API routes
- route inventory entries
- client API/composable/presentation helpers
- top-level Music Queue route and navigation
- focused server and client tests

The next high-value item is **Phase 2: Music Queue UX and match drilldowns**.
Start by replacing the visible candidate-first workflow with release-centered
Music Queue actions while keeping Import Review as advanced diagnostics.
