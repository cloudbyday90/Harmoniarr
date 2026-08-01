# Music Queue Phase 3 Failed Match Retry Design

Status: **Implemented.**
Date: 2026-06-29

## Scope

This slice hardens the Phase 3 automatic retry path after a selected match fails
before or during download handoff.

Implemented target:

- keep the failed match terminal so it is not automatically selected again
- carry the release's Music Queue quality context into persisted match evidence
- re-rank remaining scoped matches after failure
- skip remaining matches that do not satisfy the effective quality profile
- promote the next acceptable match automatically when one exists
- persist bounded retry evidence in the execution-run item snapshot

This does not yet add a new Activity timeline event. The execution evidence now
has the bounded data needed for that follow-up.

## Official Sources Reviewed

| Source | Relevant guidance | Design impact |
| --- | --- | --- |
| Sonarr quality profiles: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality profiles define which qualities are wanted, which are preferred, and when upgrades stop. | Recovery cannot simply choose the next score-ranked match; it must respect the same quality gate as the first automatic choice. |
| Sonarr failed download handling: https://wiki.servarr.com/sonarr/settings#failed-download-handling | Failed download handling records history, can remove/clear the failed item, searches for replacement files, and blocklists failed releases from automatic reuse. | Harmoniarr should keep the failed match failed, exclude it from automatic recovery, and try a replacement only when policy allows. |
| Radarr quality profiles: https://wiki.servarr.com/radarr/settings#quality-profiles | Quality profiles and `Upgrade Until` govern automatic selection and future upgrades. | The match retry loop must carry fallback/cutoff context from the release, not infer quality from search text alone. |
| SABnzbd API docs: https://sabnzbd.org/wiki/advanced/api | The download client exposes queue/history state while the application owns the decision about what to enqueue. | Harmoniarr recovery should operate from persisted candidate/run evidence and not depend on live provider payloads being available forever. |
| slskd configuration docs: https://github.com/slskd/slskd/blob/master/docs/config.md | slskd API keys and directories are explicit configuration concerns. | Retry evidence must not include provider API keys, credentials, or raw path-heavy provider payloads. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Logging design should be proportionate, reconstructable, and avoid alert noise or sensitive data. | Recovery evidence records bounded candidate IDs, quality decision codes, and safe format tokens only. |

## Recommendations

1. Treat failed matches as blocked for automatic retry.
   A failed selected match transitions to `failed` and is excluded from the
   recovery candidate query.

2. Apply quality policy during retry.
   Recovery uses `acquisition-quality-policy-service` so a strict lossless
   release does not fall back to an MP3 match unless the release has an explicit
   fallback override.

3. Persist quality context with match evidence.
   Candidate ingestion now stores a bounded `normalizedPayload.musicQueue`
   object with `profileCode` and `qualityOverride`. This gives later workers
   enough context without querying unrelated tables or storing secrets.

4. Keep skipped matches recoverable.
   Matches skipped because of quality are not marked failed or rejected. If the
   operator later allows fallback quality, they can be reconsidered by a new
   search/selection path.

5. Keep retry evidence bounded.
   Execution snapshots record skipped candidate IDs, quality decision codes, and
   format tokens. They do not store raw provider payloads, credentials, or full
   filesystem paths.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Apply the quality gate in recovery service | Reuses existing policy, low churn, easy focused tests, keeps first-choice and fallback-choice behavior aligned | Recovery still depends on candidate evidence carrying the right context | Adopted |
| Add new match-attempt tables now | Cleanest long-term audit model | Larger schema and UI migration before the retry rule is proven | Defer |
| Mutate below-quality matches to failed/rejected | Easy to exclude from future automatic selection | Incorrect: quality policy can change through fallback override, so the match is not inherently bad | Rejected |
| Keep score-only next-match promotion | Minimal code | Violates quality preferences and can download a lower-quality fallback without consent | Rejected |

## Final Recommendation Stack

- **Quality context:** `normalizeSlskdResponsesToImportCandidates*` persists
  `normalizedPayload.musicQueue` for provider-ingested matches.
- **Browse enrichment:** `candidate-browse-enrichment-service.js` preserves the
  same context when a browsed folder replaces the original search response.
- **Recovery policy:** `import-candidate-recovery-service.js` loops through
  scoped replacement matches, skips non-eligible quality decisions, and promotes
  only an acceptable match.
- **Repository query:** `findNextCandidateForRecovery` still uses the original
  single-exclusion path by default and supports an exclusion array only when the
  service has skipped additional matches.
- **Module wiring:** `import-candidate-module.js` injects
  `createAcquisitionQualityPolicyService()` into recovery.
- **Evidence:** execution snapshots retain the recovery result with bounded
  skipped-match reason codes.

## Security Notes

- No new public route or browser mutation was added.
- Quality override context is release-scoped and bounded. It does not include
  provider credentials.
- Skipped-match evidence stores only candidate IDs, quality codes, reason codes,
  and short format token arrays.
- Failed-match recovery remains inside existing operation-run and candidate
  transition boundaries.

## Outcome

When a selected match fails to enqueue or later fails through transfer
reconciliation, Harmoniarr now:

1. marks that match failed
2. increments its download attempt count
3. searches for the next scoped pending/held match
4. skips matches that fail the effective quality profile
5. promotes the next acceptable match if one exists
6. schedules rediscovery or reports no eligible match when none remain

For example, if a `Lossless archive` release has an MP3 match ranked above a
FLAC match after the failed candidate, recovery skips the MP3 with
`quality_below_minimum` and promotes the FLAC match.

## Next Slice

Continue Phase 3 with automatic completed-download handling:

1. derive release-centered `ready to add` from completed transfer evidence
2. run add-to-library preview automatically when safe
3. add the release to the library without manual Import Review navigation when
   the plan is safe
4. stop as `Needs help` only when folder, collision, quality, or policy
   checks require a human decision
