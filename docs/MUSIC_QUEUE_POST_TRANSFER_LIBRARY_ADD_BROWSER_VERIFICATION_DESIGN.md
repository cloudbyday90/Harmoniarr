# Music Queue Post-Transfer Library Add Browser Verification Design

Status: **Implemented.**

Date: 2026-07-26.

This document records the deterministic post-transfer acceptance slice for the
Music Queue. It proves the home-user outcome after Harmoniarr has a completed
eligible transfer:

`download completed -> audio checked -> ready to add -> adding to library -> in library`

The normal path stays automatic. The user can view release details, but is not
sent to candidate or import-run diagnostics. An unsafe claimed-lossless result
stops at the release with one repair action and no claim that it reached the
library.

---

## 1. Official Sources Reviewed

| Source | Design input |
| --- | --- |
| [Radarr settings and completed-download handling](https://wiki.servarr.com/radarr/settings) | A completed-download flow should follow the download client's completion state, know the reported final location, and then inspect and import into the media library. Container path and permission failures are expected setup risks, not conditions to bypass. |
| [Sonarr quick start guide](https://wiki.servarr.com/en/sonarr/quick-start-guide) | Monitoring and quality profiles are set before automatic acquisition. The normal library workflow should remain profile-led rather than asking the user to curate every found file. |
| [FFprobe documentation](https://ffmpeg.org/ffprobe.html) | Media verification should consume machine-readable stream and container metadata, not filename extensions alone. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Browser tests should assert user-visible behavior with resilient locators, isolate state, and control dependencies outside the product boundary. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Activity data should be consistent and correlatable while minimizing payloads to the context necessary for diagnosis. |

---

## 2. Recommendation

1. Treat `Ready to add` as an automatic transition state, not a request for the
   user to open a diagnostics plan. Its primary affordance is now `View
   details`; safe automation continues in the worker.

2. Preserve the existing `wantedReleaseId` from the import candidate's Music
   Queue context when the safe apply worker emits `release_added`. The Activity
   story coalescer already uses that durable release identity to join automatic
   lifecycle events.

3. Test both outcomes in the Docker-backed browser runtime with controlled
   first-party queue and Activity projections:
   - verified media reaches `In library` and presents one expandable Activity
     story
   - unsafe claimed-lossless media stops at `Quality choice needed`, has one
     `Review quality choice` handoff, and has no library action

4. Keep the proof independent of public Soulseek peers. Peer availability and
   remote catalog contents are external integration concerns; deterministic
   acceptance verifies Harmoniarr's own state transitions and presentation.

---

## 3. Approaches Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Browser test only, with no worker event correlation change | Low implementation effort. | The production `release_added` event remains candidate-scoped and may not join the release timeline. | Reject. |
| Require the user to review an add plan after every completed transfer | Exposes all diagnostics. | Reintroduces manual runway work and contradicts automatic Music Queue behavior. | Reject. |
| Exercise public Soulseek in acceptance tests | Uses live peers. | Non-deterministic, can expose external behavior to test timing, and cannot prove repeatable local outcomes. | Reject. |
| Bounded worker correlation plus Docker-backed browser projections | Tests the production event contract and the visible success/stop states with controlled dependencies. | Does not itself execute ffprobe against fixture files. | Adopt. |

---

## 4. Final Recommendation Stack

### Product and UI

- `Ready to add` uses `View details`, not a diagnostics-route call to action.
- `Adding to library` remains informative while the background worker runs.
- `In library` offers the normal `Open Library` handoff.
- `Quality choice needed` offers only `Review quality choice`; it never offers
  a false library result.

### Backend and Activity

- `import-candidate-apply-worker.js` passes
  `musicQueueContext.wantedReleaseId` to the release-added event builder.
- `release-added-activity-presentation-service.js` trims and includes that
  optional ID in the bounded event payload.
- The existing Activity coalescer uses the durable release ID to join automatic
  download, audio, and library-add milestones.

### Security

- The event adds only an existing internal release identifier; it does not add
  a filesystem path, provider response, credential, or media metadata dump.
- The value is accepted only as a non-empty string and is trimmed before it is
  persisted in the Activity payload.
- The browser contract mocks only first-party read-model routes in an isolated
  Docker/PostgreSQL test runtime. It does not contact or depend on a public
  peer.

### Validation

- Unit test: release-added presentation preserves a trimmed wanted-release ID.
- Worker test: safe apply emits the correlated `release_added` event.
- Client presentation test: `add_to_library` maps to local details rather than
  the diagnostics route.
- Browser test: verified completion reaches library and yields one Activity
  story; unsafe media remains stopped with one quality repair action.

---

## 5. Outcome

Implemented the post-transfer contract in these modules:

- `src/client/lib/acquisition-pipeline-presentation.js`
- `src/server/activity/release-added-activity-presentation-service.js`
- `src/server/import-candidates/import-candidate-apply-worker.js`
- `test/browser/music-queue-post-transfer-library-add-browser-verification.test.js`

The browser verification uses a real application and temporary PostgreSQL
runtime, while deterministic route fixtures stand in only for asynchronous
queue and Activity projections. This proves the normal UI does not require
candidate-first navigation and the unsafe UI cannot imply a completed library
add.

---

## 6. Next High-Value Item

Add a file-backed Docker integration acceptance fixture: generate a small local
lossless test asset and a deliberately mislabeled/lossy asset, run persisted
completed-transfer reconciliation through actual ffprobe/spectral policy and
safe apply, then assert the resulting persisted Activity story. This covers the
remaining real-file boundary without relying on public Soulseek behavior.
