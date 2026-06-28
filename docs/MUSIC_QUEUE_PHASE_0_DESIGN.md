# Music Queue Phase 0 Design

Status: **Phase 0 complete / Phase 1 ready.**

Date: 2026-06-28.

This document records the initial design, research, and evaluation decisions for
the Music Queue redesign. It is the Phase 0 outcome document for
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md).

Phase 0 does not add runtime code. Its job is to make the product contract,
status contract, quality contract, Activity boundary, and payload shape explicit
before Phase 1 creates modular read-model and presentation services.

Architecture-impacting open questions were closed after this Phase 0 contract in
[MUSIC_QUEUE_OPEN_QUESTIONS_DECISIONS.md](MUSIC_QUEUE_OPEN_QUESTIONS_DECISIONS.md).
Those decisions are binding for Phase 1.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| Servarr Sonarr settings and quality-profile docs: https://wiki.servarr.com/sonarr/settings#quality-profiles | Sonarr treats quality profiles as the control plane for automatic selection and "upgrade until" cutoff behavior. | Harmoniarr needs explicit preferred, minimum, cutoff, fallback, and upgrade rules. Search terms are hints, not enforcement. |
| Servarr Radarr settings and quality-profile docs: https://wiki.servarr.com/radarr/settings#quality-profiles | Radarr reinforces the same profile/cutoff model for automated media acquisition. | Music Queue should expose release progress, while quality logic remains policy-driven and reusable. |
| SABnzbd API and queue/history docs: https://sabnzbd.org/wiki/advanced/api and https://sabnzbd.org/wiki/extra/queue-history-searching | SABnzbd separates active queue state, history state, retries, and filtering/searching of completed or failed work. | Downloader remains the live transfer surface. Music Queue summarizes release progress. Activity remains history and diagnosis. |
| slskd configuration docs: https://github.com/slskd/slskd/blob/master/docs/config.md | slskd requires explicit credentials, API-key security, configured directories, and writable download paths. | Missing slskd or folder setup must block early as `needs_setup`, before Harmoniarr creates confusing import-pending states. |
| FFmpeg ffprobe docs: https://ffmpeg.org/ffprobe.html | ffprobe can produce machine-readable stream and format metadata, including JSON output and audio stream selection. | Harmoniarr should verify actual audio codec/container evidence before treating a file as satisfying a quality profile. |
| FFmpeg filter docs for `aspectralstats`: https://ffmpeg.org/ffmpeg-filters.html#aspectralstats | FFmpeg can calculate frequency-domain audio statistics frame by frame. | Spectral checks are valid supporting evidence for suspicious/transcoded lossless detection. |
| W3C WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Progress, waiting, success, and error messages must be programmatically determinable without forcing focus changes. | Music Queue and Activity status changes need clear text, stable status regions, and non-modal updates unless user action is required. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Logging requirements should be defined during design, with proportional event content, enough detail for reconstruction, and no unnecessary sensitive data. | Activity events should record auditable release/match/download/quality/library-add outcomes without leaking secrets or raw provider credentials. |

---

## 2. Recommendations

1. Use **Music Queue** as the user-facing release progress surface.
   Do not make users operate `import_candidates`.

2. Keep **Downloader** as the live transfer surface.
   It should show active/queued/complete/failed transfers, not release policy.

3. Keep **Activity** as history and diagnosis.
   Activity should answer "what happened?" and link to the right repair surface.
   It should not be the normal place to run downloads.

4. Keep **Import Review** as advanced diagnostics.
   It should remain available during migration, but should not be the happy path.

5. Make quality policy explicit.
   A release can be automatically downloaded only when a match satisfies the
   profile minimum, and it can be considered complete only when cutoff is met.

6. Verify lossless claims before library add.
   Filename, extension, or provider text such as `FLAC` is not enough. Strict
   lossless needs ffprobe evidence and spectral evidence or a deliberate
   policy-accepted inconclusive result.

7. Stop early for setup blockers.
   Missing slskd configuration, unhealthy provider state, missing download
   directories, inaccessible music roots, or missing media tooling must produce
   `needs_setup` before download handoff.

8. Hide candidates unless automation stops.
   Candidates are match evidence. They become visible only for match choice,
   quality choice, library-add blockers, failed attempts, or diagnostics.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep current Activity > Candidates workflow | Lowest short-term code churn. Existing tests already cover much of it. | Keeps exposing raw implementation state. Users must understand candidates, selected queues, apply runs, and import blockers. | Reject as primary UX. Keep as diagnostics during migration. |
| Build a new release-centered Music Queue read model | Clear mental model. Lets users see one row per desired release. Allows automation to proceed without manual candidate curation. | Requires a new read-model layer across wanted releases, searches, candidates, transfers, media checks, and apply runs. | Adopt for Phase 1. |
| Rename all backend `acquisition` and `candidate` modules immediately | Maximum language consistency. | High churn, high regression risk, little immediate user value. | Reject. Keep backend precision while hiding internals from UI. |
| Add policy-only read model first, then automate deeper actions | Lower risk. Lets UI and tests prove statuses before mutating behavior. | Does not immediately fix every automatic-download gap. | Adopt for Phase 1. |
| Jump straight to automatic download and import behavior | Fastest path to user-visible automation. | Risky without a stable status contract, quality gate, and setup blocker contract. | Defer to Phase 3 and Phase 4. |

---

## 4. Final Recommendation Stack

### Product Stack

- **Music Queue**: release progress and next action.
- **Downloader**: live transfer queue and transfer details.
- **Library**: completed music and final state.
- **Artist Detail**: monitoring policy, release overrides, and retry context.
- **Settings**: provider, folder, and media-tool setup.
- **Activity**: timeline, history, failures, and repair handoffs.
- **Advanced diagnostics**: old Import Review/candidate/runway controls.

### Backend Stack

- New `src/server/acquisition/` modules are acceptable as internal domain code
  if they stay modular and do not leak terminology into the happy-path UI:
  - `acquisition-pipeline-store.js`
  - `acquisition-pipeline-status-service.js`
  - `acquisition-quality-policy-service.js`
  - `acquisition-pipeline-service.js`
- Routes should be thin adapters, likely under `/api/v1/acquisition/releases`
  until a later route naming decision. Responses must use user-facing labels.
- Stores read existing state first. No schema migration is required for Phase 1
  unless the first implementation proves match-attempt history cannot be derived
  safely from existing tables.

### Client Stack

- New `MusicQueueView.vue` for the primary user-facing surface.
- New `useMusicQueue.js` composable for polling/revalidation.
- New `music-queue-presentation.js` helper for labels, tones, actions, and
  progress steps.
- Import Review remains route-backed diagnostics until replacement coverage
  exists.

### Security Stack

- No provider API keys, secrets, raw slskd credentials, or filesystem secrets in
  Activity payloads.
- Status payloads may include stable IDs, release names, artist names, safe
  diagnostic reason codes, and route targets.
- Mutating actions require existing auth, CSRF, role, and fresh-session rules.
- Event logging must be sufficient for reconstruction but proportionate, avoiding
  alert noise.

### Validation Stack

- Phase 1: focused server tests for status projection and quality policy.
- Phase 1: focused client tests for presentation labels/actions.
- Phase 2: browser tests for Music Queue layout and stopped-state repair flows.
- Phase 3 and Phase 4: integration tests for auto-selection, fallback, verified
  audio quality, and safe library add.
- Phase 7: local Docker walkthrough proof from monitored artist to library add.

---

## 5. Current Activity Route Classification

| Current route/tab | Current purpose | Future placement |
| --- | --- | --- |
| `activity-operations` / Operations | Operation runs and job diagnostics. | Activity diagnostics, not default. Link from events and alerts. |
| `activity-candidates` / Candidates | Import Review workbench and candidate operations. | Advanced diagnostics. Replace happy path with Music Queue. |
| `activity-requests` / Requests | Request tracking. | Activity filter or My Requests route, depending persona. |
| `activity-wanted` / Wanted | Wanted release ledger. | Music Queue input ledger; optional diagnostics or secondary ledger view. |
| `activity-imports` / Imports | Import readiness and blocked import-pending candidates. | Music Queue stopped states plus advanced diagnostics. |
| `activity-releases` / Releases | Release activity/readiness. | Music Queue and Library links. |
| `activity-users` / Users | Source-user trust and related operator actions. | Advanced diagnostics or Settings-style trust controls. |
| `activity-history` / History | Recent operation/activity history. | Activity default candidate. Rename/collapse into timeline. |
| `activity-blocklist` / Blocklist | Source-user blocklist controls. | Advanced diagnostics or Settings. |
| `activity-ignored` / Ignored | Ignored source users. | Advanced diagnostics or Settings. |
| `activity-failed` / Failed | Failed import candidates. | Activity failure filter plus Music Queue stopped rows. |
| `activity-monitored-artists` / Artists | Monitored artist operational state. | Home/Artist Detail, with Activity events linking back. |

Decision: Activity should default to a timeline/history surface. Operational
tabs remain temporarily during migration but are reclassified as diagnostics or
owned by Music Queue, Downloader, Settings, Artist Detail, or Library.

---

## 6. Import Review And Candidate Module Evaluation

| Module area | Keep as | Phase 0 decision |
| --- | --- | --- |
| `import-candidate-auto-selection-service.js` | Internal match-choice engine | Reuse for high-confidence match choice, but rename UI output to "match". |
| `import-candidate-selection-readiness.js` | Internal readiness policy | Reuse thresholds. Translate `auto_selectable`, `ambiguous`, `low_confidence`, and `unscored` into Music Queue statuses. |
| `import-candidate-execution-service.js` | Download handoff runner | Reuse, but Phase 3 needs candidate-scoped execution and fallback semantics. |
| `import-candidate-execution-reconciliation-service.js` | Transfer reconciliation | Reuse to derive `downloading`, `trying_next_match`, `download_failed`, and `ready_to_add`. |
| `import-candidate-media-inspection-service.js` | Audio and file inspection | Reuse for verified quality and add-to-library safety. |
| `import-candidate-apply-preview-service.js` | Library-add preview | Reuse for `ready_to_add` and `needs_help_adding`. User-facing copy should say "add to library". |
| `import-candidate-apply-service.js` / worker | Library-add executor | Reuse as the engine behind automatic or manual `Add to library`. |
| `ImportReviewView.vue` | Diagnostics UI | Keep route-backed during migration. Do not make it the normal workflow. |

Decision: existing services become evidence providers behind the Music Queue read
model. They should not be deleted in Phase 1.

---

## 7. User-Facing Language Contract

| Internal/old term | User-facing term | Notes |
| --- | --- | --- |
| Acquisition | Music Queue / getting music | Avoid as a page title. Keep in internal modules if useful. |
| Candidate | Match | Only show `candidate` in advanced diagnostics. |
| Source | Match / provider result | Use "source" only in diagnostics when referring to provider details. |
| Import apply | Add to library | Use "apply" only in worker/run diagnostics. |
| Path mapping | Folder setup | Use "path mapping" only on advanced settings screens. |
| Needs source review | Pick a match | The user is choosing between matches. |
| Needs import review | Needs help adding | The system has files but cannot safely add them. |
| Retry acquisition | Try again | Keep copy plain. |
| Failed candidate | Match failed | Show release impact and next action. |

---

## 8. Release Progress Status Contract

These codes are the Phase 1 read-model contract. They may be backed by existing
tables, but they are not table names.

| Code | Label | Tone | User meaning | Primary next action |
| --- | --- | --- | --- | --- |
| `queued_for_search` | Waiting to search | neutral | The release is wanted and will be searched. | `Search now` |
| `searching` | Searching | info | Harmoniarr is searching providers or ingesting results. | none |
| `checking_matches` | Checking matches | info | Search results are being scored against release and quality policy. | none |
| `downloading` | Downloading | info | A match was selected and accepted by Downloader. | `Open downloader` |
| `trying_next_match` | Trying next match | warning | A previous match failed and another acceptable match is being attempted. | `View details` |
| `ready_to_add` | Ready to add | success | Downloaded files are visible and safe to add. | `Add to library` |
| `adding_to_library` | Adding to library | info | A library-add run is queued or running. | none |
| `in_library` | In library | success | Library state confirms the release was added. | `Open in library` |
| `needs_setup` | Needs setup | warning | Provider, folder, music root, or media-tool setup blocks automation. | `Set up folders` or `Configure provider` |
| `pick_match` | Pick a match | warning | Results exist, but confidence is too low or top matches are ambiguous. | `Review matches` |
| `quality_choice_needed` | Quality choice needed | warning | Available matches do not satisfy the quality profile, or downloaded files failed verification. | `Review quality choice` |
| `needs_help_adding` | Needs help adding | warning | Files are downloaded, but collision, missing file, policy, or inspection blockers prevent safe add. | `Review add plan` |
| `no_matches_left` | No matches left | danger | Harmoniarr exhausted acceptable matches for this release attempt. | `Search again` |
| `failed` | Needs retry | danger | The latest attempt failed and no automatic next step is available. | `Try again` |
| `ignored` | Ignored | neutral | The operator chose not to pursue this release. | `Include again` |

Status payload shape:

```js
{
  wantedReleaseId: 'wanted_123',
  artist: { id: 'artist_123', name: 'Forest Frank' },
  release: { title: 'Child of God', releaseGroup: 'rg_123', type: 'Album' },
  status: {
    code: 'quality_choice_needed',
    label: 'Quality choice needed',
    tone: 'warning',
    explanation: 'Only MP3 matches were found, but this release requires verified FLAC.',
  },
  nextAction: {
    code: 'review_quality_choice',
    label: 'Review quality choice',
    route: { name: 'music-queue-release', params: { wantedReleaseId: 'wanted_123' } },
    enabled: true,
  },
  progressSteps: [
    { code: 'wanted', label: 'Wanted', state: 'complete' },
    { code: 'search', label: 'Search', state: 'complete' },
    { code: 'match', label: 'Match', state: 'blocked' },
    { code: 'download', label: 'Download', state: 'waiting' },
    { code: 'quality', label: 'Audio check', state: 'waiting' },
    { code: 'library', label: 'Library', state: 'waiting' },
  ],
}
```

---

## 9. Action Contract

| Action code | Label | Mutates state | Surface |
| --- | --- | --- | --- |
| `search_now` | Search now | yes | Music Queue row |
| `search_queued_music` | Search queued music | yes | Music Queue page |
| `review_matches` | Review matches | no by itself | Stopped release detail |
| `use_match` | Use this match | yes | Match review |
| `reject_match` | Reject match | yes | Match review |
| `review_quality_choice` | Review quality choice | no by itself | Quality stopped state |
| `allow_fallback_quality` | Allow MP3 fallback | yes | Quality review |
| `download_now` | Download now | yes | Manual/advanced path |
| `open_downloader` | Open downloader | no | Music Queue row |
| `review_add_plan` | Review add plan | no by itself | Add-to-library blocker |
| `add_to_library` | Add to library | yes | Ready or reviewed add plan |
| `try_again` | Try again | yes | Failed release |
| `set_up_folders` | Set up folders | no | Setup blocker |
| `configure_provider` | Configure provider | no | Setup blocker |
| `show_advanced_diagnostics` | Show advanced diagnostics | no | Details drawer |
| `open_in_library` | Open in library | no | Completed release |
| `include_again` | Include again | yes | Ignored release |

All mutating actions must preserve current server-side auth, role, CSRF, and
fresh-session rules.

---

## 10. Quality Profile Contract

| Profile | Preferred | Minimum automatic download | Cutoff | Fallback | Auto-add rule |
| --- | --- | --- | --- | --- | --- |
| `lossless_archive` | Verified FLAC/lossless | Verified FLAC/lossless | Verified FLAC/lossless | Not allowed by default | Add only after ffprobe confirms lossless codec/container and spectral result is authentic or policy-accepted inconclusive. |
| `high_quality` | Verified FLAC/lossless | MP3 320 / V0 or better | Verified FLAC/lossless | Allowed only if profile says so | Add high-quality lossy if fallback allowed; keep upgrade search open until cutoff. |
| `any_available` | Best ranked available | Any playable audio | Any playable audio | Allowed | Add highest-confidence playable match unless unsafe add blockers exist. |

Quality decision states:

| Code | Meaning | Automatic behavior |
| --- | --- | --- |
| `preferred_met` | Match satisfies preferred quality. | Eligible for automatic download/add. |
| `minimum_met` | Match satisfies minimum but not preferred. | Eligible only if fallback is allowed. |
| `below_minimum` | Match is below minimum quality. | Do not auto-download. |
| `verification_pending` | Downloaded file needs ffprobe/spectral evidence. | Do not mark complete. |
| `verified` | Downloaded file satisfies policy evidence. | Eligible for add. |
| `suspicious` | Lossless claim failed spectral/codec sanity checks. | Stop as `quality_choice_needed`. |
| `unverified` | Probe or spectral evidence is missing/inconclusive and policy does not accept it. | Stop as `quality_choice_needed`. |

---

## 11. Candidate Hiding Rule

Default rule:

> Users manage releases. Harmoniarr manages matches.

Candidate/match evidence remains hidden when a release is:

- waiting to search
- searching
- checking matches
- downloading
- trying the next match automatically
- ready to add
- adding to library
- in library

Candidate/match evidence is visible when:

- the release is stopped at `pick_match`
- the release is stopped at `quality_choice_needed`
- the release is stopped at `needs_help_adding`
- the release is stopped at `no_matches_left`
- the user opens advanced diagnostics
- an operator follows a diagnostic link from Activity, Downloader, or an alert

Visible match detail must be simplified first:

- match title/folder
- provider/source user
- quality evidence
- track coverage
- confidence explanation
- why it was chosen, rejected, blocked, or skipped
- safe action labels

Raw candidate IDs, source search IDs, execution run IDs, and apply run IDs stay
inside advanced diagnostics.

---

## 12. Activity Boundary And Events

Activity is a timeline and diagnostic surface. It is not the primary control
surface for downloads.

Event payloads must:

- use stable event types
- include safe release, artist, and status context
- avoid secrets and provider credentials
- link to Music Queue, Downloader, Settings, Artist Detail, Library, or advanced
  diagnostics as appropriate
- support accessible status messaging in the UI

Recommended event types:

| Event type | Status | Summary pattern | Primary link |
| --- | --- | --- | --- |
| `music_queue_release_queued` | info | `{release} was added to Music Queue.` | Music Queue release |
| `music_queue_search_started` | info | `Searching for {release}.` | Music Queue release |
| `music_queue_search_completed` | info | `Found {matchCount} matches for {release}.` | Music Queue release |
| `music_queue_match_selected` | success | `Selected a match for {release}.` | Music Queue release |
| `music_queue_match_failed` | failure | `A match for {release} failed: {reason}.` | Music Queue release |
| `music_queue_trying_next_match` | warning | `Trying the next match for {release}.` | Music Queue release |
| `music_queue_no_matches_left` | failure | `No acceptable matches remain for {release}.` | Music Queue release |
| `music_queue_download_started` | info | `Download started for {release}.` | Downloader transfer |
| `music_queue_download_completed` | success | `Download completed for {release}.` | Music Queue release |
| `music_queue_audio_checked` | success | `Audio checked for {release}.` | Music Queue release |
| `music_queue_audio_warning` | warning | `Audio check found a warning for {release}.` | Music Queue release |
| `music_queue_audio_failed` | failure | `Audio check failed for {release}.` | Music Queue release |
| `music_queue_suspicious_lossless` | warning | `This download says FLAC, but Harmoniarr could not verify it as lossless.` | Quality review |
| `music_queue_library_add_started` | info | `Adding {release} to the library.` | Music Queue release |
| `music_queue_library_add_completed` | success | `{release} was added to the library.` | Library release |
| `music_queue_library_add_blocked` | warning | `{release} needs help before it can be added.` | Add plan |

Payload shape:

```js
{
  eventType: 'music_queue_suspicious_lossless',
  severity: 'warning',
  occurredAt: '2026-06-28T12:00:00.000Z',
  actorType: 'system',
  entityType: 'wanted_release',
  entityId: 'wanted_123',
  summary: 'This download says FLAC, but Harmoniarr could not verify it as lossless.',
  details: {
    artistId: 'artist_123',
    artistName: 'Forest Frank',
    releaseTitle: 'Child of God',
    wantedReleaseId: 'wanted_123',
    statusCode: 'quality_choice_needed',
    reasonCode: 'suspicious_lossless',
    qualityProfile: 'lossless_archive',
    matchAttemptId: 'attempt_456',
    safeDiagnosticRef: 'candidate_789',
  },
  link: {
    label: 'Review quality choice',
    routeName: 'music-queue-release',
    routeParams: { wantedReleaseId: 'wanted_123' },
  },
}
```

---

## 13. Match-Attempt Lifecycle

| State | Meaning | Next automatic step |
| --- | --- | --- |
| `discovered` | Provider returned a possible match. | Score and normalize. |
| `ranked` | Match has a comparable score and quality estimate. | Choose best acceptable match. |
| `selected` | Harmoniarr chose this match for this release attempt. | Enqueue download. |
| `download_queued` | Downloader accepted the handoff. | Observe transfer. |
| `downloading` | Transfer is active. | Continue observing. |
| `download_completed` | Downloader reports complete or Harmoniarr sees completed files. | Verify files. |
| `quality_verified` | Files satisfy profile evidence. | Prepare library add. |
| `add_ready` | Library-add preview is safe. | Add automatically if allowed. |
| `completed` | Release is confirmed in library. | Stop. |
| `blocked` | Match is not eligible for this attempt. | Try next acceptable match. |
| `failed` | Match failed during search, download, quality, or add. | Block match, then try next acceptable match. |
| `skipped` | Match was not chosen because a better match exists. | None unless re-ranked later. |
| `exhausted` | No acceptable match remains. | Stop as `no_matches_left`. |

Blocked reason codes:

- `download_failed`
- `download_timed_out`
- `source_disappeared`
- `quality_below_minimum`
- `quality_failed`
- `suspicious_lossless`
- `folder_setup_missing`
- `library_collision`
- `missing_downloaded_file`
- `operator_rejected`
- `provider_unavailable`

---

## 14. Walkthrough Payload Examples

### Clean Setup

```js
{
  status: { code: 'queued_for_search', label: 'Waiting to search', tone: 'neutral' },
  setup: { provider: 'healthy', folders: 'ready', mediaTools: 'ready' },
  nextAction: { code: 'search_now', label: 'Search now', enabled: true },
}
```

### Missing Folder Setup

```js
{
  status: { code: 'needs_setup', label: 'Needs setup', tone: 'warning' },
  explanation: 'Harmoniarr cannot see the folder where downloads finish.',
  blockers: [{ code: 'download_folder_missing', label: 'Download folder not connected' }],
  nextAction: { code: 'set_up_folders', label: 'Set up folders', enabled: true },
}
```

### Ambiguous Match

```js
{
  status: { code: 'pick_match', label: 'Pick a match', tone: 'warning' },
  explanation: 'Two matches are close enough that Harmoniarr needs a choice.',
  matchSummary: { visibleCount: 2, bestScore: 88, secondBestScore: 86, scoreGap: 2 },
  nextAction: { code: 'review_matches', label: 'Review matches', enabled: true },
}
```

### High-Confidence Match

```js
{
  status: { code: 'downloading', label: 'Downloading', tone: 'info' },
  explanation: 'Harmoniarr selected the best verified match and sent it to Downloader.',
  matchAttempt: { attemptedCount: 1, blockedCount: 0, nextMatchAvailable: true },
  nextAction: { code: 'open_downloader', label: 'Open downloader', enabled: true },
}
```

### Failed-Match Fallback

```js
{
  status: { code: 'trying_next_match', label: 'Trying next match', tone: 'warning' },
  explanation: 'The previous match failed to download. Harmoniarr is trying the next acceptable match.',
  matchAttempt: {
    attemptedCount: 2,
    blockedCount: 1,
    latestBlockedReason: 'download_failed',
    nextMatchAvailable: true,
  },
}
```

### FLAC Required With Lossy-Only Results

```js
{
  status: { code: 'quality_choice_needed', label: 'Quality choice needed', tone: 'warning' },
  explanation: 'Only MP3 matches were found, but this release requires verified FLAC.',
  quality: {
    profile: 'lossless_archive',
    preferred: 'flac_lossless',
    minimum: 'flac_lossless',
    cutoffReached: false,
    fallbackAllowed: false,
  },
  nextAction: { code: 'review_quality_choice', label: 'Review quality choice', enabled: true },
}
```

### Suspicious FLAC

```js
{
  status: { code: 'quality_choice_needed', label: 'Quality choice needed', tone: 'warning' },
  explanation: 'This download says FLAC, but Harmoniarr could not verify it as lossless.',
  quality: { verification: 'suspicious', codec: 'flac', spectralVerdict: 'transcoded' },
  nextAction: { code: 'review_quality_choice', label: 'Review quality choice', enabled: true },
}
```

### Ready To Add

```js
{
  status: { code: 'ready_to_add', label: 'Ready to add', tone: 'success' },
  explanation: 'The download passed audio checks and can be added to the library.',
  nextAction: { code: 'add_to_library', label: 'Add to library', enabled: true },
}
```

### Needs Help Adding

```js
{
  status: { code: 'needs_help_adding', label: 'Needs help adding', tone: 'warning' },
  explanation: 'A file with the same target path already exists in the library.',
  blockers: [{ code: 'library_collision', label: 'File already exists' }],
  nextAction: { code: 'review_add_plan', label: 'Review add plan', enabled: true },
}
```

### In Library

```js
{
  status: { code: 'in_library', label: 'In library', tone: 'success' },
  explanation: 'The release is available in your library.',
  nextAction: { code: 'open_in_library', label: 'Open in library', enabled: true },
}
```

---

## 15. Phase 1 Entry Criteria

Phase 1 can start when this document is accepted. The first implementation slice
should build a read-only projection and presentation layer:

1. Add modular status and quality policy services.
2. Add a store/service that reads existing wanted, discovery, candidate,
   downloader, media inspection, and apply evidence.
3. Add focused unit tests for each status example in this document.
4. Add client presentation helpers for labels, tones, actions, and progress
   steps.
5. Add a skeleton Music Queue route/view that consumes the read model without
   changing automation behavior yet.
