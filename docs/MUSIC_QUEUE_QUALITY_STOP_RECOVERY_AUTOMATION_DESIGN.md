# Music Queue Quality-Stop Recovery Automation Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the slice that makes Harmoniarr recover automatically when
a downloaded match fails verified audio-quality checks before safe automatic
add-to-library. A bad downloaded match should not leave the user staring at a
candidate workbench. Harmoniarr should block that match, try the next acceptable
match, and only stop for user input when there is no safe next step.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| Sonarr quality profiles: https://wiki.servarr.com/sonarr/settings#quality-profiles | Home media automation treats quality profiles and cutoffs as first-class automation policy. | Harmoniarr keeps strict `Lossless archive` failures as policy failures and does not auto-add files that fail verification. |
| Sonarr failed download handling: https://wiki.servarr.com/sonarr/settings#download-clients | Failed download handling blocks bad releases and retries alternatives. | Harmoniarr applies the same pattern to quality failures after download: fail the bad match, promote the next quality-eligible match, and queue another download run. |
| Radarr quality profiles: https://wiki.servarr.com/radarr/settings#quality-profiles | Quality profile behavior should be deterministic and profile-driven. | Recovery candidate selection reuses the Music Queue quality policy instead of picking the next raw score blindly. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Recovery events need enough evidence to diagnose behavior without leaking sensitive provider data. | Candidate events and operation-run summaries store bounded reasons, ids, and quality labels, not credentials or raw provider payloads. |
| PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html | Queue/recovery workers should avoid duplicate claims under concurrency. | This slice reuses existing operation-run queue and candidate promotion boundaries instead of adding a parallel recovery queue. |

---

## 2. Recommendations

1. Treat safe-auto quality failure as a terminal candidate failure.
   The downloaded match reached `import_pending`, but it cannot satisfy the
   selected quality profile. Mark it failed with a quality-specific event.

2. Reuse the existing recovery cascade.
   The candidate recovery service already knows how to find the next scoped
   candidate, skip below-profile matches, promote one candidate, and queue a
   follow-up execution run. Extend it rather than creating a second workflow.

3. Keep the apply worker focused.
   The apply worker records the quality block, emits Activity, and asks the
   recovery service to continue automation. It does not select candidates or
   start downloads directly.

4. Let forward motion win in Music Queue.
   If a quality-blocked match has already produced a selected next match or a
   queued download run, Music Queue should show `Checking matches`, `Trying next
   match`, or `Downloading` instead of stale `Quality choice needed`.

5. Fail safely when recovery is unavailable.
   If recovery cannot start, the quality block remains visible as
   `Quality choice needed` with the existing Activity handoff.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Leave quality blocks for manual review | Simple and safe. | Breaks the desired automatic path and keeps users in diagnostics. | Rejected as the default. |
| Retry the same candidate after quality failure | Easy to implement. | Re-downloads a known bad match and can loop. | Rejected. |
| Fail the bad match and promote the next quality-eligible candidate | Matches home media manager behavior and keeps automation moving. | Requires careful status projection so stale quality evidence does not hide progress. | Adopted. |
| Start the next download directly from the apply worker | Fast path with fewer moving parts. | Couples library-add verification to download orchestration. | Rejected. |
| Reuse the recovery service and operation runs | Preserves existing queue, audit, and retry behavior. | Requires a quality-specific recovery entry point. | Adopted. |

---

## 4. Final Recommendation Stack

- `import-candidate-service`
  - adds `markImportCandidateQualityFailed`
  - records an `import_candidate_quality_failed` event
  - records source-user outcome evidence with bounded quality label/weight
- `import-candidate-recovery-service`
  - adds `handleImportCandidateQualityFailure`
  - marks the failed downloaded match
  - increments attempt evidence
  - reuses the existing next-candidate cascade and quality policy
  - queues a follow-up download run with `quality_stop_recovery_cascade`
- `import-candidate-apply-worker`
  - calls quality recovery after safe-auto quality block persistence
  - records recovery counts in the apply run summary
  - keeps recovery failures isolated from the apply-run outcome
- `acquisition-pipeline-status-service`
  - lets active or promoted next-match states override stale quality-block
    evidence

Security posture:

- no raw provider response payloads in recovery summaries
- no credentials or source paths in new recovery events
- recovery remains scoped by candidate source search id and metadata release id
- quality policy still gates candidate promotion
- existing operation-run queuing and maintenance-lock boundaries are reused

---

## 5. Implementation Outcome

Implemented files:

- `src/server/import-candidates/import-candidate-service.js`
- `src/server/import-candidates/import-candidate-recovery-service.js`
- `src/server/import-candidates/import-candidate-apply-worker.js`
- `src/server/import-candidates/import-candidate-module.js`
- `src/server/acquisition/acquisition-pipeline-status-service.js`
- `test/server/import-candidate-service.test.js`
- `test/server/import-candidate-recovery-service.test.js`
- `test/server/import-candidate-apply-worker.test.js`
- `test/server/acquisition-pipeline-status-service.test.js`

Behavior:

- A strict-quality safe-auto failure marks the downloaded candidate as failed
  through `import_candidate_quality_failed`.
- The bad match is excluded from the next recovery selection.
- Recovery skips candidates that do not satisfy the active quality policy.
- The next quality-eligible match is promoted and a download execution run is
  queued.
- Apply run summaries report quality recovery started, rediscovery, or
  exhausted counts.
- Music Queue shows forward motion when the next match is selected or queued.
- If no recovery path exists, the release remains stopped at
  `Quality choice needed`.

---

## 6. Follow-Up

The next high-value item is browser/Docker walkthrough proof for this full
quality-stop recovery path:

1. create a fixture or local walkthrough state with one bad lossless claim and
   one acceptable next match
2. prove the bad match is failed automatically
3. prove the next match is selected and download execution is queued
4. prove Music Queue and Activity show user-readable progress without requiring
   Import Review
