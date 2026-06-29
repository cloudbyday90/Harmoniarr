# Music Queue Phase 2 Match Drilldown Design

Status: **Phase 2 slice 2 complete / Phase 2 in progress.**

Date: 2026-06-29.

This document records the second Phase 2 implementation slice for
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md).
The goal is to make `Review matches` show release-scoped match evidence without
turning raw import candidates back into the primary workflow.

---

## Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| PostgreSQL JSON functions and operators: https://www.postgresql.org/docs/current/functions-json.html | The release read model needs bounded JSON match summaries assembled near the query that already scopes wanted releases by user. | Use a lateral JSON aggregate for the top match summaries instead of issuing separate raw candidate reads from the client. |
| Vue composables guide: https://vuejs.org/guide/reusability/composables.html | The Music Queue page should keep fetch state in composables and deterministic view shaping in pure helpers. | Keep match card copy and quality-fit derivation in `acquisition-pipeline-presentation.js`, not in the template. |
| Vue conditional rendering guide: https://vuejs.org/guide/essentials/conditional.html | Match drilldowns need clear empty states and conditional sections as searches move through zero-result and result states. | Render a no-match note until bounded match summaries are available. |
| OWASP API Security API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Release-scoped match data must not allow users to enumerate another user's raw candidate records. | Keep match rows behind the app-user-scoped wanted-release aggregate and avoid adding unscoped candidate reads. |
| OWASP API Security API3 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Candidate payloads can contain paths, usernames, provider payloads, and other fields that are not appropriate for the primary Music Queue surface. | Expose only bounded fields: score, status, file counts, format evidence, track summary, size, and transfer-health hints. |

---

## Recommendations Applied

1. Keep the release as the API work object.
2. Add a bounded `matches` projection to the existing release evidence instead
   of exposing raw candidate lists to Music Queue.
3. Limit the match list to the top five candidates by score and recency.
4. Exclude raw provider payloads, folder paths, and source usernames from the
   Music Queue payload.
5. Translate candidate statuses into user-facing match states:
   `Available`, `Selected`, `Downloading`, `Ready to add`, `In library`,
   `Blocked`, and `Rejected`.
6. Show per-match quality fit against the release profile:
   `Preferred quality`, `Meets minimum`, `Below profile`, or
   `No format evidence`.
7. Keep `Advanced diagnostics` as the handoff for raw candidate detail and
   recovery controls.

---

## Pros And Cons

| Decision | Pros | Cons |
| --- | --- | --- |
| Project match summaries from the wanted-release read model | Preserves app-user scoping, keeps the UI release-centered, and avoids extra client orchestration. | The SQL aggregate is larger and needs focused tests to guard shape drift. |
| Hide source usernames and folder paths from Music Queue | Reduces provider-data leakage and keeps the primary page understandable. | Advanced operators still need diagnostics for exact source/path recovery. |
| Show top five matches only | Keeps the panel readable and avoids flooding the page with noisy provider results. | Full search-result review still requires advanced diagnostics. |
| Derive quality fit in the client presentation helper | Easy to test and iterate without changing database shape. | Deep verified-audio evidence still belongs to later Phase 4 work. |

---

## Final Recommendation Stack

### Backend Stack

- Continue using `library_wanted_releases` as the durable release ledger.
- Enrich `listWantedReleasesWithMetadata` with a bounded, release-scoped
  `import_candidate_matches` JSON projection.
- Thread simplified match rows through
  `acquisition-pipeline-service.js` as `evidence.match.matches`.
- Do not add a new raw candidate API for Music Queue.

### Client Stack

- Keep `MusicQueueView.vue` focused on release rows and a review panel.
- Keep match card shaping in `acquisition-pipeline-presentation.js`.
- Use status, score, quality fit, file count, track coverage, size, and source
  health as the simplified match evidence.
- Keep mutation buttons out of this slice; `Use this match` and `Reject match`
  need scoped mutation endpoints in a later slice.

### Security Stack

- Match drilldowns are read-only in this slice.
- App-user scoping remains anchored on wanted-release reads.
- Raw slskd payloads, folder paths, and usernames stay out of Music Queue.
- Candidate IDs are retained only as opaque match keys for future scoped
  mutation work and are not displayed.

---

## Outcome

This slice implemented:

- bounded top-five match summary projection in the wanted-release store
- Music Queue release evidence passthrough for simplified match rows
- match card presentation helpers with friendly status and quality-fit labels
- Music Queue review panel rendering for individual matches
- focused tests for SQL projection and client match-card shaping

The next high-value Phase 2 item is **release-scoped match actions**:
add scoped `Use this match` and `Reject match` mutations from Music Queue, backed
by existing candidate transition services and protected by app-user release
ownership checks.
