# Music Queue Safe Add Prerequisite Recheck Design

Status: **Implemented.**

Date: 2026-08-01.

## 1. Problem

A completed download can stop before the library add when Harmoniarr cannot
reach its completed files or when an audio check cannot complete. The previous
recovery path explained the stop and, for folders, returned people to Settings,
but it did not safely resume the exact release after the prerequisite changed.

Reusing the normal safe-auto add run was not acceptable: it can evaluate every
ready completed download. A folder repair for one release must never cause an
unrelated download to be added. A library collision, an unmet quality policy,
or a suspicious lossless claim must remain a deliberate review decision.

The implemented normal workflow is:

`fix reachable folders or media tooling -> recheck the same completed release -> preview -> quality gate -> add only that release when safe`

## 2. Official Sources Reviewed

Sources were reviewed on 2026-08-01 against the requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | A filename, extension, or declared content type is not evidence that downloaded media is safe. The recheck retains layered validation and server-controlled file handling before any library write. |
| [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Validation belongs on the server. The browser submits only a bounded wanted-release identifier; it cannot submit a candidate id, a source path, or a target path. |
| [FFprobe documentation](https://ffmpeg.org/ffprobe.html) | Media inspection is designed to report stream/container information and returns a nonzero status for an unrecognized input. A failed audio check therefore remains a stop until a fresh inspection can prove the input again. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html) | Asynchronous recovery feedback needs readable text and a programmatic status announcement, not color alone. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Tell the operator to reopen a failed match in Advanced diagnostics | Minimal implementation. | Keeps a normal prerequisite repair inside a candidate-first workflow and encourages broad, manual retries. | Reject. |
| Run the existing safe-auto add batch after a prerequisite is fixed | Small amount of code reuse. | Could add unrelated ready downloads and makes the repaired release impossible to audit precisely. | Reject. |
| Automatically retry every stopped add | Low visible friction. | Could overwrite a collision or bypass a quality stop. | Reject. |
| Recheck one server-owned release through preview and quality gates, then create a scoped operation run | Keeps automation simple for recoverable prerequisites while preserving explicit decisions for unsafe states. | Adds a narrow service, durable operation scope, and focused route coverage. | Adopt. |

## 4. Final Recommendation Stack

### Release Scope

- The client can send only `wantedReleaseId` to
  `POST /api/v1/acquisition/releases/:wantedReleaseId/recheck-library-add`.
- The acquisition service verifies the authenticated operator owns that Music
  Queue release before delegating to the recheck service.
- The recheck service obtains the latest add diagnostic through the scoped
  release read. It never accepts a candidate id, a path, a filename, or a
  provider response from the client.

### Recoverable Prerequisites

Only the following outcomes qualify:

| Stored add stop | Required condition before recheck | User surface |
| --- | --- | --- |
| `source_path_unavailable` | Folder configuration saves with all required folders healthy. | Settings rechecks the bounded release after the successful save. |
| `media_verification` with `audio_check_failed` | Media tooling is healthy. | Music Queue offers `Try audio check again`. |

The following outcomes remain confirmation-first and cannot use this endpoint:

- `library_collision`
- lossy audio below the selected policy
- suspicious claimed-lossless audio
- generic unsafe add plans
- generic add failures
- historic or malformed diagnostic records that do not match the allow-list

### Safe Execution

1. Read the latest server-owned recovery candidate for the scoped release.
2. Confirm that it is in the failed state and is an allow-listed prerequisite
   stop.
3. Confirm healthy media tooling when the prior stop was `audio_check_failed`.
4. Run a fresh, read-only library-add preview.
5. Run the existing safe-auto quality gate against that preview.
6. Reopen only the failed candidate for library add.
7. Persist a safe-auto operation run with `importCandidateIds` containing only
   that one candidate. The worker and import-pending summary carry that scope
   through queue dispatch.
8. Run the existing worker, maintenance-lock, lease, preview, and quality-gate
   safeguards again before it writes to the library.

The scope normalizer is server-owned and capped at 25 identifiers for future
internal callers. This recovery supplies exactly one. The normal Music Queue
and Settings read models expose only the release-level outcome, never raw
paths, tool output, provider information, candidate identifiers, or operation
run internals.

### UI And Accessibility

- Folder recovery stays in **Media & storage** because it is a saved Settings
  prerequisite. A healthy save reports whether the exact release resumed,
  still needs review, or remains waiting.
- Audio recovery stays in the selected Music Queue release as `Try audio check
  again`; it does not misleadingly route to a Settings form that cannot repair
  a missing deployment tool.
- Release action feedback uses the existing local live-region contract. It
  clearly distinguishes queued, waiting, unavailable tooling, and still-needs-
  review outcomes.
- Advanced diagnostics remains available as a secondary link for authorized
  people, not the normal recovery path.

## 5. Implementation Outcome

Added the following modular boundaries:

- `src/server/import-candidates/import-candidate-release-safe-add-recheck-service.js`
  owns allow-listed prerequisite eligibility, fresh preview, quality gate, and
  single-release start behavior.
- `src/server/import-candidates/import-candidate-apply-scope.js` normalizes
  internal candidate scopes and limits their size.
- The apply service, pending summary, repository, worker, run store, and
  operation queue now retain and honor `importCandidateIds` without expanding
  the repaired release into a broad apply batch.
- The acquisition module provides the authenticated, release-scoped endpoint;
  `acquisition-api.js` remains the only browser boundary for that mutation.
- `SettingsMediaStorageView.vue` turns a healthy folder repair into the
  bounded recheck and presents an accessible return outcome.
- `MusicQueueReviewPanel.vue` provides the explicit audio-check retry action.

Focused validation covers:

- scoped release authorization and CSRF protection;
- source-folder and media-tool eligibility;
- preview and quality-gate refusal without reopening the failed candidate;
- collision refusal without mutation;
- single-candidate scope persistence through operation queue dispatch;
- client API CSRF behavior and Settings outcome redaction.
- browser verification that the audio recheck uses a body with no candidate or
  filesystem identifiers, announces the scoped outcome, and refreshes only
  the selected release into the library-add state.

## 6. Follow-Up

Run a Docker-backed recovery acceptance scenario with a mounted completed
download. It should prove that fixing one folder mapping resumes only that
release, then separately prove collision and strict-quality variants remain in
review and never create an automatic add run.
