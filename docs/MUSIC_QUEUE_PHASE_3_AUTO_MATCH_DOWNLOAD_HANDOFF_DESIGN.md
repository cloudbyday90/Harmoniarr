# Music Queue Phase 3 Auto Match Download Handoff Design

Status: **Implemented.**
Date: 2026-06-29

## Scope

This slice starts Phase 3 by making automatic download handoff respect the Music
Queue quality gate.

Implemented target:

- choose exactly one high-confidence match after provider search ingestion
- require the selected match to satisfy the effective release quality profile
- preserve the existing selected-queue execution runner for advanced/manual use
- hand the selected match to the existing download execution run service
- report skipped automation with bounded reason codes rather than noisy alerts

This is not the full Phase 3 lifecycle. Failed-match blocking, automatic
next-match retry after transfer failure, and safe library add remain follow-up
slices.

## Official Sources Reviewed

| Source | Relevant guidance | Design impact |
| --- | --- | --- |
| Sonarr quality-profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Automatic search/grab behavior is governed by profile quality and cutoff rules. | Harmoniarr must not auto-download a match that misses the release's effective quality profile, even if composite score is high. |
| Radarr quality-profile settings: https://wiki.servarr.com/radarr/settings#quality-profiles | Quality profiles provide allowed qualities and upgrade goals. | Release fallback override can permit high-quality lossy handoff, but strict lossless stays blocked. |
| SABnzbd API docs: https://sabnzbd.org/wiki/advanced/api | Download clients expose queue/history state separately from the application choosing what to download. | Harmoniarr should choose one release match, then let the existing downloader execution path enqueue and observe transfer state. |
| slskd configuration docs: https://github.com/slskd/slskd/blob/master/docs/config.md | slskd requires configured directories and secure API access for downloads. | Existing provider and folder setup gates stay ahead of auto-download handoff. |
| OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | Browser state-changing requests need CSRF protection. | This slice adds no new browser mutation; existing manual actions keep CSRF/fresh-session protection. |

## Recommendations

1. Keep auto-selection release-scoped.
   The source-search result can contain matches for one search, but the decision
   must still use release policy and release quality override evidence.

2. Treat quality as a gate, not a score boost.
   A high composite score is not enough. If a strict lossless profile sees only
   MP3 evidence, automation must stop as `Quality choice needed`.

3. Select one match, then use the existing runner.
   The happy path should select a single match and call the current execution
   service. The legacy selected queue remains available for diagnostics and
   manual batch workflows.

4. Keep skipped automation quiet but inspectable.
   Skipped reasons such as `quality_below_minimum`,
   `quality_needs_verification`, `ambiguous`, and `provider_not_healthy` should
   be recorded in discovery evidence and Music Queue status, not surfaced as
   topbar alert noise.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add quality gate to existing auto-selection service | Low churn, reuses current ingestion and execution flow, easy focused tests | Still source-search scoped internally until deeper match-attempt state lands | Adopted for this slice |
| Build a new Music Queue worker now | Clean long-term shape | Larger risk; duplicates operation-run behavior before failure lifecycle is designed | Defer |
| Keep composite-score-only auto-selection | Existing behavior remains stable | Violates quality profile expectations and explains the walkthrough confusion | Rejected |
| Add manual `Download now` button as the main fix | Simple UI fix | Continues making users operate matches manually | Rejected |

## Final Recommendation Stack

- **Quality policy:** `src/server/acquisition/acquisition-quality-policy-service.js`
  evaluates candidate format evidence, including normalized extension arrays.
- **Auto-selection:** `src/server/import-candidates/import-candidate-auto-selection-service.js`
  filters best-candidate eligibility through the effective quality profile.
- **Discovery dispatch:** `src/server/library/library-discovery-dispatch-service.js`
  passes profile and fallback-override context from the claimed release request
  into auto-selection.
- **Download handoff:** `src/server/import-candidates/import-candidate-auto-download-run-service.js`
  continues to start the existing execution run for the selected match.
- **Evidence:** `library_discovery_requests.evidence.autoSelection` and
  `.autoDownloadStart` remain the bounded audit trail for this slice.

## Security Notes

- No new public route is added.
- Existing manual Music Queue mutations keep fresh-session and CSRF controls.
- Provider credentials and raw folder paths are not stored in the new
  auto-selection evidence.
- The selection service only calls the existing candidate transition after the
  high-confidence and quality gates pass.

## Outcome

Automatic download handoff now requires both:

1. high-confidence match selection readiness
2. accepted quality evidence for the effective release profile

For a `Lossless archive` release, an MP3-only match is skipped with
`quality_below_minimum` unless a release-scoped fallback override is active. For
a fallback override or high-quality profile, high-bitrate lossy matches can move
to the existing selected-match download execution path.

## Next Slice

Continue Phase 3 with durable match-attempt state:

1. block a failed match for the release attempt
2. persist the failed reason as bounded evidence
3. re-rank remaining acceptable matches
4. automatically try the next match when one exists
