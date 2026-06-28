# Music Queue Phase 2 UX Design

Status: **Phase 2 slice 1 complete / Phase 2 in progress.**

Date: 2026-06-28.

This document records the first Phase 2 implementation slice for
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md).
Phase 2 moves the user-facing workflow away from raw candidate operation and
toward release-centered Music Queue rows.

---

## Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| Vue Router lazy loading guide: https://router.vuejs.org/guide/advanced/lazy-loading.html | The Music Queue route should remain independently loaded from heavier diagnostics surfaces. | Keep `MusicQueueView.vue` as a lazy top-level route and leave Import Review as separate diagnostics. |
| Vue composables guide: https://vuejs.org/guide/reusability/composables.html | Filtering, revalidation, and UI state should remain isolated from route wiring. | Continue using `useMusicQueue` and pure presentation helpers. |
| WAI-ARIA Authoring Practices disclosure pattern: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ | Stopped-release details need clear, keyboard-accessible reveal behavior. | Use explicit `Details` / `Review matches` buttons with `aria-expanded` and a persistent details panel. |
| W3C WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Queue state and stop reasons should be visible text, not hidden visual-only status. | Rows show state, reason, last activity, quality decision, and next action as text. |
| OWASP API Security API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Release-specific diagnostics must stay scoped to the current authenticated user. | Phase 2 continues to use the Phase 1 scoped read model; no raw candidate payloads are exposed in Music Queue. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Diagnostics should be useful without leaking provider payloads, paths, or credentials. | Music Queue shows bounded match counts, scores, quality decisions, and handoffs only. |

---

## Recommendations Applied

1. Make `Music Queue` the primary release workflow surface.
2. Rename the visible Activity candidate tab to diagnostics language.
3. Rename Import Review copy from `Download candidates` to `Match diagnostics`.
4. Add six high-level Music Queue summary buckets:
   `Waiting`, `Searching`, `Downloading`, `Ready to add`, `Needs help`,
   and `Needs setup`.
5. Add release-centered filtering by search text, state, and release type.
6. Show each row with artist, release, type/year, state, reason, last activity,
   quality decision, progress chips, and next action.
7. Add a details panel behind `Review matches`, `Review quality choice`, and
   `Details`.
8. Keep raw Import Review controls accessible as `Advanced diagnostics`.

---

## Pros And Cons

| Decision | Pros | Cons |
| --- | --- | --- |
| Keep Import Review mounted but relabel it as diagnostics | Preserves existing routes, tests, and recovery tools while reducing candidate-first product language. | Users can still reach the advanced surface before it is fully hidden behind release context. |
| Put match/quality details in the Music Queue side panel | Gives stopped releases an immediate explanation without exposing raw provider payloads. | The first slice uses aggregate match evidence, not individual candidate rows yet. |
| Add filters before deeper automation | Makes the queue usable as more releases accumulate. | Filter state is local-only for now and not encoded into URL query state. |
| Use route handoffs for setup/add/downloader actions | Avoids unsafe mutations before automation policy is complete. | Some actions still send users to existing operational pages rather than completing the task inline. |

---

## Final Recommendation Stack

### Product Stack

- `Music Queue`: release progress, stop reasons, filters, and next actions.
- `Match diagnostics`: advanced Import Review workbench for raw candidate
  inspection and admin recovery.
- `Activity`: timeline/history/diagnostics, not the normal download workflow.

### Client Stack

- Keep `src/client/views/MusicQueueView.vue` as the primary UX.
- Keep Phase 2 behavior in `src/client/lib/acquisition-pipeline-presentation.js`
  where it can be tested without rendering the view.
- Keep raw Import Review under `activity-candidates` for diagnostics while
  later phases introduce release-scoped match drilldowns.

### Security Stack

- No new mutations in this slice.
- No raw provider response payloads, source file paths, API keys, or credentials
  are exposed by Music Queue.
- Existing authenticated, app-user-scoped Music Queue read path remains the
  only new API surface.

---

## Outcome

This slice implemented:

- richer Music Queue summary cards
- release filters for state, type, and search text
- row-level state, reason, last activity, quality, progress chips, and action
- match/quality details panel with advanced diagnostics handoff
- Activity copy that points users to Music Queue for release progress
- Import Review copy that presents the old candidate surface as diagnostics
- focused tests for filters, action mapping, summary cards, and match review

The next high-value Phase 2 item is **release-scoped match drilldown data**:
wire individual simplified match rows into Music Queue so `Review matches` can
show `Use this match`, `Reject match`, quality fit, and why automation did or
did not choose a match without sending the user into raw Import Review.
