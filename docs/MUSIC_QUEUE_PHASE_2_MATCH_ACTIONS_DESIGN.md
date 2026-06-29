# Music Queue Phase 2 Match Actions Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the Phase 2 slice that adds release-scoped Music Queue
match actions. It follows
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md)
and builds on the Phase 1 read model without making raw Import Review candidates
the primary user workflow again.

## Official Sources Reviewed

| Source | Why it matters | Decision |
| --- | --- | --- |
| OWASP API Security API1:2023 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Any endpoint that receives object IDs must check the logged-in user can act on the specific object. | Music Queue match actions use release-scoped routes and re-read the wanted release by `appUserId` before delegating to candidate transitions. |
| OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | Mutating browser requests need CSRF protection and custom request headers. | The client sends existing `X-CSRF-Token` headers, and the routes require fresh session plus CSRF. |
| Express routing guide: https://expressjs.com/en/guide/routing/ | Route paths should express resource boundaries clearly and keep handlers as focused adapters. | The new endpoints are nested under `/api/v1/acquisition/releases/:wantedReleaseId/matches/:matchId`. |
| Vue event handling guide: https://vuejs.org/guide/essentials/event-handling.html | Vue recommends method handlers when click behavior has meaningful logic. | Music Queue buttons call named handlers that delegate to the composable, rather than embedding mutation logic in the template. |
| W3C WCAG 2.2 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Success and failure feedback should be programmatically determinable without forcing focus changes. | Match action success uses `role="status"` and failures use `role="alert"`. |

## Recommendation

Add scoped `Use this match` and `Reject match` actions to Music Queue. Keep raw
candidate transition endpoints available for advanced diagnostics, but do not
make the Music Queue UI call them directly.

The route authority is:

```text
POST /api/v1/acquisition/releases/:wantedReleaseId/matches/:matchId/use
POST /api/v1/acquisition/releases/:wantedReleaseId/matches/:matchId/reject
```

The service validates:

- the session user can see the wanted release
- the match belongs to that release's bounded match evidence
- the request has a fresh session and CSRF token
- the underlying candidate transition is still valid

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Call raw Import Review candidate endpoints from Music Queue | Lowest implementation work. | Reintroduces candidate IDs as the primary authority and makes object-level authorization easier to bypass accidentally. | Rejected. |
| Add release-scoped Music Queue mutation endpoints | Aligns route authority with the user-facing release workflow and gives the server a single place to prove match ownership before mutation. | Adds thin adapter methods over existing candidate transitions. | Adopted. |
| Build new candidate transition logic inside Music Queue | Could tailor behavior exactly to Music Queue. | Duplicates state-machine rules already covered by Import Review services. | Rejected. |
| Hide all match actions until automation is complete | Avoids manual actions. | Leaves stopped releases unresolved during the migration. | Rejected for Phase 2. |

## Final Stack

### Backend

- `acquisition-pipeline-service.js` owns the release-scoped action guard.
- `import-candidate-service.js` remains the transition owner for selected and
  rejected candidate states.
- `acquisition-routes.js` stays a thin adapter for auth, CSRF, request metadata,
  and response shape.
- `route-inventory.js` lists the two new mutation routes.

### Client

- `acquisition-api.js` exposes CSRF-backed scoped actions.
- `useMusicQueue.js` owns mutation state and refreshes the Music Queue read
  model after success.
- `acquisition-pipeline-presentation.js` decides which match cards can render
  `Use this match` or `Reject match`.
- `MusicQueueView.vue` renders accessible success/error feedback and disables
  match buttons while a mutation is running.

### Security

- Fresh session required.
- CSRF required.
- App-user release scope checked before the candidate transition.
- Match IDs are accepted only when present in the release's bounded match
  evidence.
- The response returns the refreshed release projection instead of raw provider
  payloads.

## Outcome

Music Queue now lets the operator resolve a stopped release from the release
detail panel without navigating into `Activity > Candidates`. This completes the
first part of the Phase 2 button redesign. `Review quality choice` and
`Try again` remain separate slices because they need quality/fallback and retry
policy decisions beyond simple candidate review transitions.
