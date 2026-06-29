# Music Queue And Activity Surfacing Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the slice that makes safe automatic add-to-library quality
stops visible in Music Queue and Activity. The goal is simple: when Harmoniarr
downloads files but refuses to add them because the audio does not satisfy the
selected quality profile, the user should see one clear reason and one useful
place to go.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| W3C WCAG status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Status and error changes should be perceivable without unnecessary context changes. | Music Queue keeps the release in a visible stopped state and Activity records a plain-language event. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Operational events should explain what happened without leaking secrets or unsafe payloads. | Activity events store bounded quality blockers, release identifiers, and candidate identifiers, not provider credentials or raw provider responses. |
| Playwright locators: https://playwright.dev/docs/locators | Browser checks should target user-visible behavior rather than implementation details. | Follow-up browser proof should assert the Music Queue state, Activity copy, and repair link by role/text. |
| FFmpeg ffprobe documentation: https://ffmpeg.org/ffprobe.html | Audio quality decisions need machine-readable stream evidence. | Safe-auto add failures remain grounded in ffprobe/spectral evidence and expose only the resulting blocker message. |
| Sonarr quality profiles: https://wiki.servarr.com/sonarr/settings#quality-profiles | Home media automation uses profiles/cutoffs to decide when automation can continue. | Harmoniarr treats a strict lossless profile failure as a stopped release, not as a generic import-pending candidate. |

---

## 2. Recommendations

1. Keep Music Queue release-centered.
   A downloaded release that fails the safe-auto quality gate should project as
   `Quality choice needed`, not `Ready to add`.

2. Use Activity as a readable history.
   Activity should record the quality stop and link back to Music Queue. It
   should not require users to understand Import Review candidates.

3. Preserve diagnostics without exposing them by default.
   The event payload carries the wanted release id, import candidate id, profile
   code, checked file count, and sanitized blocker messages. Source paths,
   credentials, and raw provider payloads stay out of the user-facing event.

4. Prefer deep links over generic diagnostics.
   Activity links open the Music Queue release review route so the user lands on
   the release that needs attention.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep quality stops only in Import Review | Minimal backend change. | Users see a confusing candidate workbench and Music Queue can claim a release is ready when it is not. | Rejected. |
| Add a dedicated Activity event for every audio-check file | Very detailed timeline. | Too noisy for home use and likely to bury the useful action. | Rejected for this slice. |
| Add one quality-stop event per blocked safe-auto add | Clear, actionable, and auditable. | File-level successful checks are not yet visible in Activity. | Adopted. |
| Link Activity to advanced diagnostics | Complete internal context. | Keeps the normal workflow tied to implementation details. | Rejected for primary action. |
| Link Activity to Music Queue release review | Release-centered and easy to understand. | Requires Music Queue route-level selected-release state. | Adopted. |

---

## 4. Final Recommendation Stack

- `library-wanted-release-store`
  - projects latest add-to-library run evidence for each wanted release
  - exposes a bounded `libraryAddSummary`
- `acquisition-pipeline-status-service`
  - gives `quality_blocked` add evidence priority over `Ready to add`
- `music-queue-quality-activity-presentation-service`
  - builds sanitized `music_queue_quality_blocked` Activity events
- `import-candidate-apply-worker`
  - emits the Activity event when safe-auto add stops on verified-quality
    failure
- `activity-event-normalization` and `activity-event-link-targets`
  - format the event as `Quality choice needed` and link it to Music Queue
- `MusicQueueView`
  - supports `/app/music-queue/:wantedReleaseId` deep links by selecting the
    release review panel from the route

Security posture:

- no provider secrets in Activity
- no raw provider payloads in Activity
- no raw source/download path fallback in quality-stop titles
- release/candidate ownership is still enforced by the existing Music Queue API
  routes before mutation

---

## 5. Implementation Outcome

Implemented files:

- `src/server/library/library-wanted-release-store.js`
- `src/server/acquisition/acquisition-pipeline-service.js`
- `src/server/acquisition/acquisition-pipeline-status-service.js`
- `src/server/activity/music-queue-quality-activity-presentation-service.js`
- `src/server/activity/activity-event-service.js`
- `src/server/import-candidates/import-candidate-apply-worker.js`
- `src/client/lib/activity-event-normalization.js`
- `src/client/lib/activity-event-link-targets.js`
- `src/client/views/MusicQueueView.vue`
- `src/server/migrations/20260630_050000_add_music_queue_quality_blocked_activity_event.sql`
- `src/server/schema-snapshot.sql`

Behavior:

- Safe-auto add failures with `quality_blocked` now keep the release stopped at
  `Quality choice needed`.
- The Music Queue detail message uses the quality-gate failure message when it
  is available.
- Activity records `music_queue_quality_blocked` for strict-quality add stops.
- Activity links quality stops to the selected Music Queue release review.
- Import candidate ids are not treated as Music Queue release ids when a wanted
  release id is absent.

---

## 6. Follow-Up

The next high-value item is quality-stop recovery automation:

1. block the failed-quality match for that wanted release
2. automatically try the next acceptable match when one exists
3. keep `Quality choice needed` only when no acceptable automated path remains
4. show the fallback/try-again choice in Music Queue for the remaining stopped
   cases
