# Music Queue Phase 2 Search Again Action Design

Status: **Implemented.**
Date: 2026-06-29

## Scope

This slice adds a release-scoped `Search again` / `Try again` action for stopped
Music Queue releases. It is the first write action after the quality-choice
review slice.

Implemented outcome:

- `POST /api/v1/acquisition/releases/:wantedReleaseId/search-again`
- fresh-session and CSRF protection on the new route
- release ownership verification before any write
- stopped-state guard so normal queued/in-progress releases cannot be retried
  through this action
- one-release discovery reset through `library_discovery_requests`
- bounded `musicQueueRediscovery` evidence on the discovery request
- optional start of the existing Library discovery dispatch operation
- graceful success when discovery dispatch is already running
- Music Queue details panel button for quality-stopped, failed, and no-match
  releases

This does **not** implement `Allow fallback quality`. That action changes the
release quality contract and should land as a separate policy/audit slice.

## Official Sources Reviewed

| Source | Relevant guidance | Design impact |
| --- | --- | --- |
| Servarr Sonarr quality-profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality profiles and cutoff behavior drive automatic acquisition decisions. | `Search again` should rerun discovery without silently changing the quality profile. |
| Servarr Radarr quality-profile settings: https://wiki.servarr.com/radarr/settings#quality-profiles | Retry/manual search is separate from profile/cutoff policy. | Retrying search and accepting fallback quality should be separate actions. |
| OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | State-changing browser requests need CSRF defenses. | The route uses the same fresh-session + CSRF pattern as existing Music Queue match mutations. |
| OWASP API Security - Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | APIs must re-check object-level authorization for every object identifier. | The service resolves the wanted release through the scoped Music Queue read path before resetting discovery state. |

## Recommendations

1. Keep retry release-scoped.
   The user is retrying a release, not mutating a candidate.

2. Reuse the Library discovery operation.
   The action should mark the release ready and then start the existing
   discovery dispatch worker, preserving provider gates, operation-run
   observability, and maintenance-lock behavior.

3. Do not change quality policy during retry.
   Searching again should look for a better match under the current rules. The
   future fallback action should be explicit and audited.

4. Store bounded retry evidence.
   Persist action time, actor, wanted release id, prior request state, and reason
   code. Do not store provider payloads or search responses in the action
   evidence.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Mark one release ready and start existing discovery dispatch | Reuses provider/setup gates, operation history, and worker behavior | Discovery may be picked up asynchronously rather than instant slskd call | Adopted |
| Call slskd directly from Music Queue action | Immediate search behavior | Duplicates dispatch logic and bypasses existing gates | Rejected |
| Bundle fallback quality and retry together | Fewer clicks | Silently changes desired quality semantics | Rejected |
| Route users to Wanted/Activity to run global discovery | Avoids new endpoint | Keeps the old multi-surface confusion | Rejected |

## Final Recommendation Stack

- **Route:** `src/server/routes/acquisition-routes.js`
- **Service:** `src/server/acquisition/acquisition-pipeline-service.js`
- **Persistence owner:** `src/server/library/library-discovery-request-store.js`
- **Client API:** `src/client/lib/acquisition-api.js`
- **Composable:** `src/client/composables/useMusicQueue.js`
- **UI:** `src/client/views/MusicQueueView.vue`

## Security Notes

- Mutation requires fresh session and CSRF.
- The service scopes the wanted release to the session app user before writing.
- The discovery reset writes by metadata release id only after the scoped wanted
  release is found.
- The action is rejected for releases that are not stopped in
  `quality_choice_needed`, `failed`, or `no_matches_left`.
- Provider secrets, usernames, file paths, and raw search results are not stored
  in the retry evidence.

## Outcome

Stopped Music Queue releases now have a direct, user-friendly action:

- `Search again` for `Quality choice needed`
- `Try again` for `Failed` / `No matches left`

The action queues one release for discovery immediately and starts the existing
discovery run unless one is already active.

## Next Slice

`Allow fallback quality` later landed in
`MUSIC_QUEUE_PHASE_2_FALLBACK_QUALITY_ACTION_DESIGN.md`.

Next move is Phase 3 automation: automatically select and download the best
acceptable match when Music Queue no longer needs help.
