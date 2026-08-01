# Music Queue Unsafe Add Recovery States Design

Status: **Implemented.**

Date: 2026-08-01.

## 1. Problem

The first release-centred add-blocker slice moved unsafe library-add outcomes
out of the candidate-first workflow, but several materially different safety
stops still shared one generic explanation. A household user could not tell
whether an existing library file, low-quality audio, a suspicious lossless
claim, an unfinished audio check, or an unsafe file plan had stopped progress.

The normal workflow must stay simple:

`download complete -> verify safely -> add to library or Needs help`

Music Queue and Activity should explain the next safe step for the release.
Candidate records, file paths, source users, and worker output remain behind
Advanced diagnostics for the authorized operator.

## 2. Official Sources Reviewed

These official sources were rechecked on 2026-08-01 against the requested June
2026 design baseline.

| Source | Design input |
| --- | --- |
| [FFprobe documentation](https://ffmpeg.org/ffprobe.html) | Media inspection provides machine-readable stream and container evidence; an unrecognized input exits nonzero. Automatic library writes must stop when inspection cannot establish safe evidence. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | A claimed extension or content type is not trustworthy. Use layered validation and server-controlled file handling before accepting downloaded media into the library. |
| [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) | User-facing failures should be generic enough not to expose internals, while detailed diagnostics stay in protected logs or diagnostic views. |
| [WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) | A visible error must identify the problem in text; color or an icon is not enough. |
| [WCAG 2.2 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion) | When a correction is known and safe to provide, present a specific next step rather than a vague failure message. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep one generic `Needs help` message | Small implementation and no new state. | Does not explain the safe next step and sends every outcome through the same vague review. | Reject. |
| Show raw quality-gate, ffprobe, path, and worker output in Music Queue | Gives maximum immediate detail. | Exposes filesystem and provider-adjacent details, makes normal UI noisy, and couples the normal workflow to diagnostics. | Reject. |
| Add a high-cardinality database enum for every tool and file failure | Strong database typing. | Requires schema churn for every diagnostic code and turns implementation detail into public workflow state. | Reject. |
| Persist the existing broad blocker category plus a bounded media-only recovery reason | Gives clear release-level recovery copy, preserves historical inference, keeps the API narrow, and does not leak raw details. | Requires a shared allow-list and read-model projection. | Adopt. |

## 4. Final Recommendation Stack

### Durable State

- Keep the existing broad safe-add blocker categories:
  `add_failed`, `library_collision`, `media_verification`,
  `source_path_unavailable`, and `unsafe_add_plan`.
- For `media_verification` only, persist one allow-listed recovery reason in
  the existing apply-run snapshot:
  `lossy_audio`, `suspicious_lossless`, or `audio_check_failed`.
- Existing snapshots without the new field remain supported. The release read
  model derives the same bounded reason from historic quality-gate codes.
- A recovery reason can never override a non-media blocker category.

### Release And Activity Presentation

| Safe stop | Release-centred explanation | Primary action |
| --- | --- | --- |
| Existing library file | Existing library files need review | Review library conflict |
| Audio below selected quality | Downloaded audio is below your quality setting | Review audio quality |
| Suspicious claimed lossless audio | Lossless audio needs review | Review lossless check |
| Audio inspection or proof cannot finish | Audio check could not finish | Review audio check |
| Completed files cannot be reached | Completed files are not reachable | Set up folders |
| Generic unsafe add plan | Safe add plan needs review | Review add plan |
| Add operation stopped safely | Adding this release stopped safely | Review add result |

- Each action opens the release in Music Queue, except folder setup, which
  uses the existing allow-listed Settings return handoff.
- Advanced diagnostics remains a secondary release-scoped link. It is never
  the first navigation target for normal Music Queue or Activity use.
- Activity uses the exact same safe presentation and release target as Music
  Queue, so users receive one consistent story.

### Security And Reliability

- The shared presentation module accepts only a bounded reason code. It never
  builds normal UI copy from paths, filenames, source usernames, provider
  responses, ffprobe output, or exception messages.
- Music Queue no longer projects the raw quality-gate object in its normal
  release evidence. Protected diagnostics retains the detailed run outcome.
- Existing release authorization, diagnostic authorization, collision checks,
  safe preview, maintenance lock, and worker lease boundaries remain unchanged.
- Historical data has a safe generic media-verification fallback; no migration
  or broad database rewrite is required.

## 5. Implementation Outcome

Added `src/shared/music-queue-add-recovery-presentation.js` as the shared
allow-listed mapping for server and client presentation.

- The safe-auto apply worker records a bounded recovery reason in its apply
  snapshot and `music_queue_import_blocked` Activity event.
- The wanted-release read model retains that durable reason while deriving a
  compatible safe fallback from historic quality-gate codes.
- Music Queue status, row actions, release review, Activity detail, Activity
  link labels, and release-scoped library-add diagnostics use the same
  outcome-specific mapping.
- Folder setup preserves the bounded Settings return context from the selected
  Music Queue release.

Focused validation passed on 2026-08-01:

- 105 server/client tests covering worker persistence, historic projection,
  status precedence, read-model redaction, client labels, Activity handoffs,
  and diagnostic redaction.
- The Music Queue browser verification covers a suspicious claimed-lossless
  stop, its release-centred action, Advanced diagnostics secondary handoff,
  and matching Activity route.

## 6. Follow-Up

The implemented release-level prerequisite recheck is documented in
[MUSIC_QUEUE_SAFE_ADD_PREREQUISITE_RECHECK_DESIGN.md](MUSIC_QUEUE_SAFE_ADD_PREREQUISITE_RECHECK_DESIGN.md).
It resumes only a folder- or audio-tool-blocked release after a fresh preview
and quality gate. Collision and quality stops remain confirmation-first.
