# Music Queue Pipeline Redesign Plan

Status: **Design / execution plan.** This document is the umbrella plan for
replacing the current Import Review-first "Download candidates" experience with
a release-centered Music Queue workflow.

The current pipeline has strong backend pieces: wanted release generation,
Soulseek discovery, match scoring, download execution, transfer reconciliation,
library add, and recovery. The problem is the product shape.
The UI exposes raw implementation objects and asks the operator to understand
too many internal gates before the happy path works.

The redesign target is:

`Add monitored artist -> desired releases are searched -> safe matches download -> safe downloads are added to the library -> exceptions ask for help.`

Import candidates still exist internally, but they stop being the primary work
object. The primary work object becomes the **release in Music Queue**.

---

## 1. Problem Statement

The current `Activity > Candidates` surface is clunky because it presents
`import_candidates` as the work queue. That creates several user-facing issues:

- A monitored artist can create desired releases correctly, but the user sees no
  immediate progress unless they know to inspect Wanted, Import
  Review, Downloader, Background Jobs, and Imports.
- "Download candidates" sounds like the system is ready to download, but many
  rows are raw search results that are pending, ambiguous, low-confidence,
  blocked, stale, or unrelated to the user's current intent.
- The main page asks the operator to manually select, inspect, queue, reconcile,
  and apply. That is the opposite of the automation goal.
- The stage buttons (`Inspect media`, `Queue downloads`, `Apply to library`) are
  technically accurate but too low-level for the happy path.
- Configuration blockers such as missing folder setup appear late, after the
  system has already created candidate/import-pending state.
- Release-level progress is scattered across `library_wanted_releases`,
  `library_discovery_requests`, `import_candidates`, execution runs, apply runs,
  Downloader, and Activity.

The result is a system that technically works in pieces but does not feel like
an automated Music Queue pipeline.

---

## 2. Product Principles

1. **Release first.**
   The user wants a release added, not a candidate reviewed. Every primary row
   should represent a desired release and its Music Queue state.

2. **Automation is the default.**
   If setup is valid and confidence is high, Harmoniarr should continue without
   asking for confirmation at each internal stage.

3. **Candidates are evidence, not the work queue.**
   Source candidates belong behind `Review matches`, `Why stopped?`, or
   diagnostic drilldowns.

4. **Manual review is an exception state.**
   The UI should say what stopped automation: ambiguous match, low confidence,
   missing folder setup, provider unavailable, unsafe import plan, failed
   transfer, or policy block.

5. **Every button must answer a user question.**
   Buttons should be named after outcomes: `Review matches`, `Try again`,
   `Set up folders`, `Add to library`, `Skip this release`, `Use this match`.

6. **Advanced operator controls are still available.**
   Execution runs, media inspection, transfer sync, and apply details remain
   visible, but move into an `Advanced diagnostics` section.

---

## 3. User-Friendly Language Contract

Harmoniarr is a home music app. The UI should not sound like an enterprise
workflow system. Use plain language for the main surfaces and reserve precise
technical terms for code, logs, and diagnostics.

Primary user-facing name:

> Music Queue

Use `Music Queue` for the page that explains what Harmoniarr is finding,
downloading, adding to the library, or waiting on.

Terminology map:

| Internal term | User-facing term | Notes |
| --- | --- | --- |
| Acquisition | Getting music / Music Queue | Do not use `Acquisition` as the page title. |
| Candidate | Match | Only show `candidate` in advanced diagnostics. |
| Source option | Match | `Available matches` is clearer than `source options`. |
| Provider | Soulseek / download service | Use the concrete service name when possible. |
| Import | Add to library | `Import` is acceptable in diagnostics, not primary buttons. |
| Import apply | Add to library | Never show `apply` as a user action. |
| Path mapping | Folder setup | Use `path mapping` only on advanced settings screens. |
| Blocked setup | Needs setup | Friendlier and clearer. |
| Needs source review | Pick a match | The user is choosing among matches, not reviewing sources. |
| Needs quality review | Quality choice needed | Explain the mismatch plainly. |
| Ready to import | Ready to add | Library-oriented language. |
| Imported | In library | Outcome language. |
| Retry acquisition | Try again | Avoid abstract workflow language. |

Suggested visible labels:

| Status code | User label |
| --- | --- |
| `queued_for_search` | Waiting to search |
| `searching` | Searching |
| `choosing_source` | Checking matches |
| `needs_source_review` | Pick a match |
| `needs_quality_review` | Quality choice needed |
| `downloading` | Downloading |
| `ready_to_import` | Ready to add |
| `needs_import_review` | Needs help adding |
| `importing` | Adding to library |
| `imported` | In library |
| `blocked_setup` | Needs setup |
| `failed` | Needs retry |
| `ignored` | Skipped |

The documentation and backend may still use `acquisition` as a concise domain
name, but any UI title, button, empty state, toast, or normal user-facing route
copy should follow this table.

---

## 4. Activity Boundary And Navigation Model

Activity should mean **what happened**, not **where I go to make downloads work**.

The current Activity area has accumulated too many operational workbenches:
operations, candidates, wanted, imports, releases, users, history, blocklist,
ignored, failed, artists, and recovery-oriented pages. That makes Activity feel
like the control center for the app. For a home-user music app, that is the
wrong center of gravity.

Expected default behavior:

- Adding or monitoring an artist should automatically create wanted releases.
- Wanted releases should automatically search when setup is ready.
- Good matches should automatically download.
- Completed downloads should automatically add to the library when safe.
- The Downloader page should show live downloads when they exist.
- Home, Artist Detail, Missing, and Music Queue should show progress and simple
  next actions.
- Activity should not be required for the happy path.

New Activity role:

| Activity should contain | Activity should not contain |
| --- | --- |
| Human-readable event history. | Primary download/match selection workflow. |
| Recent failures with one clear repair action. | Raw candidate queue as a default tab. |
| Operation run history and diagnostics. | Routine wanted-release progress as the main experience. |
| Audit trail for policy saves, searches, downloads, audio checks, library adds, and retries. | Button-heavy workbenches for normal users. |
| Links back to the right surface: Music Queue, Artist Detail, Settings, Downloader, Library. | Parallel control surfaces that compete with the main workflow. |

Activity overhaul target:

1. [x] Collapse Activity into a readable timeline first. Implemented with the
   bounded `/app/activity/feed` timeline, outcome filters, and a compact
   `Advanced diagnostics` disclosure. See
   `docs/ACTIVITY_TIMELINE_NAVIGATION_DESIGN.md`.
2. Keep `Operations`/advanced diagnostics behind an operator-only diagnostics
   section.
3. Move wanted progress and match/download/add-to-library state to Music Queue.
4. Move live transfer state to Downloader.
5. Move release policy and retry context to Artist Detail.
6. Keep Activity actions minimal: `View`, `Try again`, `Set up folders`,
   `Open Music Queue`, `Open Downloader`, `Open Library`.

Audio-quality verification should appear in Activity as normal events because it
answers "what happened to my music?" without asking the user to operate the
pipeline.

Activity event examples:

| Event | Plain summary | Action |
| --- | --- | --- |
| Audio checked | `Harmoniarr verified 12 FLAC files for Lauren Daigle - How Can It Be.` | `Open Music Queue` |
| Audio check warning | `Harmoniarr checked How Can It Be, but 1 file could not be verified as lossless.` | `Review quality choice` |
| Audio check failed | `Harmoniarr could not inspect 3 files because ffprobe is unavailable.` | `Set up media tools` |
| Suspicious FLAC found | `This download says FLAC, but Harmoniarr could not verify it as lossless.` | `Review quality choice` |
| Match failed, trying next | `The first match failed. Harmoniarr is trying the next best match.` | `Open Music Queue` |
| No matches left | `No good matches are left. Harmoniarr will search again later.` | `Open Music Queue` |
| Added to library | `How Can It Be was added to your library.` | `Open Library` |

This also means Music Queue should not feel like an Activity sub-tab. It can be
linked from Activity, but it should be designed as a primary music workflow
surface.

---

## 5. Reference Operating Model

Harmoniarr should behave closer to Sonarr/Radarr/SABnzbd in the parts of the
problem that are already solved well:

| Pattern | How those apps frame it | Harmoniarr design implication |
| --- | --- | --- |
| Wanted ledger | A durable list of missing items that should be acquired. | `library_wanted_releases` stays the durable desired-state ledger. |
| Indexers/providers | Search sources are dependencies, not the work object. | Soulseek/slskd is a provider. Future providers should plug into the same acquisition read model. |
| Download client | SABnzbd/Transmission/qBittorrent own transfer mechanics. | slskd owns Soulseek transfer mechanics; Harmoniarr owns release intent, source choice, and import outcome. |
| Quality profile | Quality rules decide what is acceptable, preferred, and when to stop upgrading. | Quality profiles must gate auto-selection and library add, not just append query text. |
| Queue | The queue shows current work and blockers. | Music Queue rows should show release progress and next action. |
| Manual search | Manual search is an override/debug path, not the normal path. | `Review matches` should be available when automation stops, not required for every wanted release. |
| History | History explains what happened after the fact. | Activity and operation runs remain audit trails, not the primary control surface. |

This means the main workflow is:

1. Artist policy creates desired releases.
2. Desired releases enter the Music Queue.
3. Providers search automatically.
4. Harmoniarr scores sources against release identity and quality profile.
5. High-confidence, policy-compliant sources download automatically.
6. Completed downloads import automatically when the import plan is safe.
7. Exceptions stop with one reason and one action.

The user should not have to understand candidate IDs, source search IDs, run IDs,
or selected queues for the normal path.

### File-Backed Runtime Acceptance

The safe automatic add boundary has an additional Docker-backed proof. It
creates deterministic local fixtures inside the production image, reconciles a
completed transfer through the persisted queue, and proves both a verified FLAC
add and an MP3-derived FLAC quality stop with durable Activity evidence. This
avoids treating public Soulseek peers as a release-test dependency. See
`MUSIC_QUEUE_FILE_BACKED_DOCKER_ACCEPTANCE_DESIGN.md`.

---

## 6. Candidate Role And Simplification Boundary

The purpose of an import candidate is internal evidence:

- one provider response or response group that might satisfy a desired release
- matched files and track coverage
- quality evidence such as FLAC/MP3, bitrate, bit depth, sample rate, and file
  consistency
- peer/uploader evidence
- transfer/import evidence
- audit trail for why automation chose, skipped, rejected, or retried a source

That does **not** mean the user should look at candidates during normal use.
Candidates are the equivalent of indexer release rows in Sonarr/Radarr: useful
for scoring, manual search, debugging, and audit, but not the primary task.

The simplified product rule:

> Users manage releases. Harmoniarr manages candidates.

Primary workflow:

1. Show the desired release.
2. Show the acquisition state.
3. Show the one reason automation stopped, only if it stopped.
4. Show the one action that resolves the stop.

Candidate details should be hidden unless one of these is true:

- automation cannot safely choose a source
- quality policy blocks the available sources
- import preview requires a human decision
- a transfer/import failed and diagnostics are needed
- the operator explicitly opens advanced diagnostics

This removes the current `Download candidates` mental model. The page should not
ask the operator to curate candidate rows just because search results exist.

Candidate UI becomes exception UI:

| Situation | Primary user sees | Candidate detail availability |
| --- | --- | --- |
| One strong source meets quality policy | `Downloading` or `Ready to import` | Hidden by default. |
| No acceptable source found | `Needs help: no good match found` | `View search results` optional. |
| FLAC required but only MP3 found | `Quality choice needed: only MP3 found` | `Review matches`. |
| Two sources are close | `Pick a match` | Show simplified match choices. |
| Import collision or path issue | `Needs help adding` or `Needs setup` | Show library-add plan, not raw candidate first. |
| Transfer/import failure | `Needs retry` with `Try again` | Diagnostics drawer includes candidate/run detail. |

The candidate table can remain as `Advanced diagnostics`, but it should stop
being the default route, default page title, or default action path.

### Automatic Match Choice And Fallback

Harmoniarr should choose matches automatically using the factors we define. The
user should not need to pick a match when one clearly satisfies the release,
quality profile, and safety rules.

Automatic match ranking factors:

- desired audio format and minimum quality
- verified or inferred codec/bitrate/sample-rate evidence
- track count and title matching
- release title, artist, year, and edition match
- folder completeness and file consistency
- peer availability, queue length, and upload speed
- source-user trust and prior delivery quality
- prior failures for this same release/match
- import safety: path visibility, collisions, media-tool readiness, and policy
  blockers

Automatic fallback rule:

1. Rank acceptable matches.
2. Pick the best acceptable match.
3. Start the download.
4. If the download fails, times out, disappears, or later fails verification,
   mark that match as blocked for this release attempt with a reason.
5. Re-rank the remaining acceptable matches.
6. Try the next acceptable match automatically.
7. Stop only when:
   - no acceptable matches remain
   - all remaining matches fail the quality profile
   - setup prevents progress
   - import/add-to-library safety requires a human decision
   - retry limits are exhausted

Blocked match reasons should be durable and visible in diagnostics:

| Reason | Meaning |
| --- | --- |
| `download_failed` | Downloader rejected or failed the transfer. |
| `download_timed_out` | Transfer did not progress inside policy limits. |
| `source_disappeared` | Provider no longer reports the transfer/source. |
| `quality_failed` | Downloaded files failed codec/spectral verification. |
| `import_blocked` | Files are present but cannot be safely added. |
| `operator_rejected` | Operator explicitly rejected the match. |

Music Queue should summarize fallback without exposing raw candidate details:

> Tried 2 matches. Trying the next best FLAC match.

If all matches fail:

> No good matches left. Harmoniarr will search again later.

---

## 7. Quality Profile And Cutoff Model

Format preference is currently under-honored. Appending `FLAC` to a search query
is useful, but it is not enough. Quality must be part of source eligibility,
ranking, fallback, and the reason automation stops.

Define quality policy with these concepts:

| Concept | Meaning |
| --- | --- |
| `preferredQuality` | Best desired outcome, such as `flac_lossless`. |
| `minimumQuality` | Lowest acceptable automatic download, such as `lossless` or `mp3_320`. |
| `cutoffQuality` | Quality at or above which the release is considered complete and no upgrade search is needed. |
| `fallbackAllowed` | Whether Harmoniarr may auto-download below preferred quality when the minimum is still met. |
| `manualReviewBelowPreferred` | Whether a source that meets minimum but misses preferred quality must stop for review. |
| `upgradeAllowed` | Whether a lower-quality acquired release should keep searching for a better source. |

Example default profiles:

| Profile | Preferred | Minimum | Cutoff | Automation behavior |
| --- | --- | --- | --- | --- |
| `Lossless archive` | FLAC lossless | FLAC lossless | FLAC lossless | Do not auto-download MP3. Stop as `needs_quality_review` if only lossy sources exist. |
| `High quality` | FLAC lossless | MP3 320 / V0 | FLAC lossless | Auto-download high-quality lossy only if fallback is allowed; keep upgrade search open. |
| `Any available` | Any | Any | Any | Auto-download the highest-confidence acceptable source. |

Quality evaluation should happen in three places:

1. **Search planning:** include preferred terms such as `FLAC`, but do not rely
   on query text as enforcement.
2. **Source scoring:** rank sources by identity match, completeness, quality,
   peer health, uploader trust, and import safety.
3. **Auto-selection gate:** refuse to auto-select sources below minimum; stop for
   review or keep searching when preferred quality is not met.

For the specific FLAC case:

- If the acquisition profile requires lossless, MP3 candidates must not be
  selected automatically.
- If no FLAC source exists, the release should explain `Only lossy sources found`
  and offer `Review matches`, `Search again`, or `Allow MP3 fallback`.
- If FLAC is preferred but high-quality lossy fallback is allowed, the row should
  show that it is a fallback acquisition and keep the release eligible for a
  future upgrade search until cutoff quality is reached.

### Verified Audio Quality Gate

Harmoniarr already has the right building blocks:

- `media-inspection-service.js` uses `ffprobe` to read the real container,
  primary audio codec, bitrate, sample rate, bit depth, channel count, duration,
  and tags.
- `ffmpeg-spectral-analyzer.js` uses `ffmpeg`/`aspectralstats` to sample decoded
  audio and estimate spectral cutoff.
- `media-spectral-analysis.js` classifies lossless-claimed files as
  `authentic`, `suspicious`, `transcoded`, or `inconclusive`.
- `media-content-fingerprint.js` and `file-content-hasher.js` provide sampled
  content fingerprints so expensive spectral measurements can be cached.
- `media-delivery-quality.js` already grades applied files for codec/extension
  mismatch, low bitrate, incomplete tags, and suspicious lossless bitrate.

The missing product rule is that these signals must become part of the automatic
quality gate:

| Claim | Required verification before treating as true |
| --- | --- |
| `FLAC` / lossless | Extension or provider claim is not enough. ffprobe must report a lossless codec such as `flac`, and spectral analysis must be `authentic` or policy-accepted `inconclusive`. |
| High-quality lossy | ffprobe must report a lossy codec with bitrate/quality evidence meeting the profile floor. |
| Unknown / probe failed | Do not auto-satisfy a strict profile. Stop as `Quality choice needed` or keep searching. |
| Suspicious/transcoded lossless | Do not satisfy `Lossless archive`; either reject the match automatically or show `Quality choice needed`. |

For `Lossless archive`, the safe default is:

1. Search can rank filename/provider hints early.
2. Download may start only if the source is otherwise high-confidence.
3. Before adding to the library, verify every required file with ffprobe.
4. For lossless-claimed files, run or require cached spectral verification.
5. If any required file is lossy, suspicious, transcoded, or unverified under a
   strict profile, stop before adding and show the plain reason:
   `This download says FLAC, but Harmoniarr could not verify it as lossless.`

This is not a perfect proof of original-master fidelity. It is a practical
verification gate: codec truth, container truth, bitrate sanity, and spectral
fake-lossless detection. That is enough to prevent the common failure mode where
an MP3 transcode is renamed or wrapped as FLAC and treated as satisfying a
lossless preference.

---

## 8. New Top-Level Experience

Replace the old `Activity > Candidates` primary experience with **Music Queue**.
Do not design Music Queue as just another Activity tab. It is the readable
progress surface for music Harmoniarr is trying to add.

Primary page title:

> Music Queue

Primary subtitle:

> See what Harmoniarr is finding, downloading, and adding to your library.
> Harmoniarr keeps going automatically when the match, quality, and folder setup
> are safe.

Primary summary cards:

| Card | Meaning |
| --- | --- |
| `Queued` | Desired releases waiting for search dispatch. |
| `Searching` | Searches dispatched or waiting for provider responses. |
| `Downloading` | Source selected and transfer accepted by Downloader. |
| `Ready to add` | Completed download is visible and can be added to the library. |
| `Needs help` | Harmoniarr stopped for match, quality, add-to-library, or policy review. |
| `Needs setup` | Folder or download-service setup prevents progress. |

Primary table/card rows:

| Column | Purpose |
| --- | --- |
| `Release` | Artist, release title, type, year. |
| `State` | Release-centered acquisition status. |
| `Why` | Short explanation: "Waiting for next search", "Top two sources are close", "Path mapping missing". |
| `Next action` | One clear user action, or "Automatic". |
| `Last activity` | Latest relevant event/run/search time. |
| `Progress` | Compact step chips: Wanted, Search, Match, Download, Add, Library. |

Source/candidate evidence becomes a drill-in only when needed:

- `Review matches`
- `Review quality choice`
- `View transfer diagnostics`
- `View add-to-library plan`
- `Show advanced run details`

---

## 9. Release-Centered State Model

Add a read-model layer that maps existing backend state into release-centered
status codes. These codes are UI and orchestration concepts; they do not need to
replace existing tables in the first phase.

Final Phase 0 contract:
[MUSIC_QUEUE_PHASE_0_DESIGN.md](MUSIC_QUEUE_PHASE_0_DESIGN.md).

| Status | User meaning | Derived from |
| --- | --- | --- |
| `queued_for_search` | Desired release exists and will be searched. | `library_discovery_requests.request_status = ready` with no active search evidence. |
| `searching` | Soulseek search is in progress or responses are being ingested. | Latest discovery dispatch/run evidence not terminal, or recent claimed request. |
| `checking_matches` | Search results are being scored. | Candidate ingestion exists without final confidence classification. |
| `pick_match` | Candidate results exist but are ambiguous, low-confidence, or unscored. | Candidate readiness codes `ambiguous`, `low_confidence`, `unscored`, multiple close candidates. |
| `quality_choice_needed` | Matches or downloaded files do not satisfy the quality profile for automatic progress. | Top candidates miss minimum/preferred quality, fallback requires confirmation, or media verification failed. |
| `downloading` | A match was selected and accepted by Downloader. | Selected/downloading candidate or execution item with accepted transfer evidence. |
| `trying_next_match` | The previous match failed and Harmoniarr is trying the next acceptable match. | Failed/blocked candidate exists and another acceptable candidate is available. |
| `retrying_search` | Harmoniarr has a scheduled automatic search retry. | A prior search has a bounded attempt count and a valid `ready` or `cooldown` retry schedule. |
| `ready_to_add` | Download completed and Harmoniarr can see safe files. | `import_pending` candidate with add-to-library preview status ready or ready-with-warnings accepted by policy. |
| `needs_help_adding` | Download completed but library-add plan needs human decision. | `import_pending` candidate blocked/warning due to folder, collision, lossy derivative, media issue, or file decision. |
| `adding_to_library` | Library-add run is pending/running. | Active import apply operation run. |
| `in_library` | Release is applied and library read model confirms it is available. | Applied candidate and matched library release. |
| `needs_setup` | Required setup is missing. | slskd not configured/healthy, no folder setup, music root missing, media tooling unavailable. |
| `no_matches_left` | No acceptable match remains for this release attempt. | Failed/blocked candidate evidence with no remaining acceptable candidate. |
| `failed` | The current attempt failed and requires recovery. | Failed candidate, failed execution/apply item, exhausted rediscovery. |
| `ignored` | Operator chose not to pursue this release. | Future explicit release-level ignore/visibility state. |

The status object should also include:

```js
{
  code,
  tone,
  label, // user-facing label, e.g. "Ready to add"
  explanation,
  nextAction: {
    code,
    label,
    route,
    enabled,
    reason,
  },
  quality: {
    profile: 'Lossless archive',
    preferred: 'FLAC lossless',
    minimum: 'FLAC lossless',
    cutoffReached: false,
    fallbackAllowed: false,
  },
  matchAttempt: {
    attemptedCount: 2,
    blockedCount: 1,
    nextMatchAvailable: true,
    latestBlockedReason: 'download_failed',
  },
  progressSteps: [
    { code: 'wanted', state: 'complete' },
    { code: 'search', state: 'active' },
    { code: 'match', state: 'waiting' },
    { code: 'download', state: 'waiting' },
    { code: 'quality', state: 'waiting' },
    { code: 'library', state: 'waiting' },
  ],
}
```

---

## 10. Button Redesign

Remove internal-stage buttons from the primary happy path. Keep them in
diagnostics.

| Current button/control | Problem | New primary action |
| --- | --- | --- |
| `Select` candidate | Exposes candidate state machine. | `Use this match` inside match review only. |
| `Hold` | Vague and candidate-level. | `Needs review` state with `Leave for review`; advanced action only. |
| `Reject` | Candidate-level; unclear release outcome. | `Reject match` inside match review. |
| `Reopen` | Internal recovery term. | `Try this match again` or `Review again`, depending on state. |
| `Start download run` | Operation-run language. | `Download now` only when automation is disabled or blocked by manual review. |
| `Sync transfer state` | Internal reconciliation action. | `Refresh download status`; advanced diagnostics keeps `Sync transfer state`. |
| `Start import apply` | Internal apply-worker language. | `Add to library`. |
| `Run discovery now` | Acceptable but should be release-centered when scoped. | `Search now` for one release, `Search queued music` for batch. |
| `Open candidate` | Internal object. | `Review matches` or `View match details` in diagnostics. |
| `Open in Downloader` | Fine as a diagnostic handoff. | Keep under transfer detail. |
| `Open Library` | Good outcome handoff. | Keep. |

Default page-level actions:

- `Search queued music`
- `Try again`
- `Set up folders`
- `Show advanced diagnostics`

Per-release actions:

- `Review matches`
- `Review quality choice`
- `Search now`
- `Download now`
- `Add to library`
- `Try again`
- `Set up folders`
- `Allow MP3 fallback`
- `Ignore release`
- `Open in Library`

---

## 11. Backend Architecture

Create a release-centered read model without deleting the existing candidate
system.

Recommended modules:

- `src/server/acquisition/acquisition-pipeline-store.js`
  - SQL-only aggregation helpers.
  - Reads wanted releases, discovery requests, candidate aggregates,
    execution/apply state, and setup settings.

- `src/server/acquisition/acquisition-pipeline-status-service.js`
  - Pure-ish status derivation from normalized store rows.
  - Owns release-centered `code`, `label`, `explanation`, `nextAction`, and
    progress step mapping.

- `src/server/acquisition/acquisition-quality-policy-service.js`
  - Pure quality eligibility and cutoff derivation.
  - Normalizes candidate format evidence against acquisition profile rules.
  - Decides whether a candidate is acceptable, preferred, fallback, or blocked.

- `src/server/acquisition/acquisition-pipeline-service.js`
  - Composes store + status service.
  - Exposes list/detail payloads.

- `src/server/routes/acquisition-routes.js`
  - Thin route adapter:
    - `GET /api/v1/acquisition/releases`
    - `GET /api/v1/acquisition/releases/:wantedReleaseId`
    - future mutations for release-scoped actions.

- `src/client/lib/acquisition-pipeline-presentation.js`
  - Client-only formatting helpers for fixed status/action enums.

- `src/client/lib/acquisition-quality-presentation.js`
  - Client-only labels for quality profiles, cutoff state, fallback state, and
    blocked-quality explanations.

- `src/client/composables/useAcquisitionPipeline.js`
  - Fetch, poll, filter, and refresh.

- `src/client/views/MusicQueueView.vue`
  - User-facing page for the release-centered Music Queue workflow.
  - Replaces the primary `ImportReviewView` route experience over time.

Existing Import Review modules remain available as detail/diagnostic components.

---

## 12. UI Architecture

Phase the UI to reduce risk.

### Primary Page

The Music Queue view should be dense and scan-first:

- top summary card band
- filters by artist, status, reason, release type, and last activity
- release-centered table or compact cards
- expandable row detail for current source/download/import context
- quality profile and cutoff state visible per row when it affects automation
- one primary action per row

### Match Review Drawer/Panel

Only visible when a release needs match or quality review, or when the operator
explicitly opens match details:

- simplified ranked source choices backed by candidates
- confidence tier
- quality tier, preferred/minimum/cutoff match, and fallback status
- score breakdown
- matched/missing tracks
- uploader trust
- folder path
- choose/reject source actions

The drawer title should avoid `Candidate` unless the user is in diagnostics.
Use `Available matches` for the normal review path.

### Advanced Diagnostics

Keep current runway controls, but behind `Show advanced diagnostics`:

- media inspection run
- download execution run
- import apply run
- transfer sync
- raw candidate filters
- historical operation run detail

This lets power users debug without making every user operate the machinery.

---

## 13. Automation Policy

Automation should proceed through the full pipeline when all are true:

- slskd is configured and healthy
- download path mapping exists and resolves to a readable Harmoniarr path
- music library root is configured and writable
- media tooling is healthy when import validation requires it
- candidate confidence clears source-selection thresholds
- candidate quality satisfies the acquisition profile minimum
- preferred quality is met, or profile policy explicitly allows automatic
  fallback below preferred quality
- candidate has not already failed or been blocked for the current release
  attempt
- import preview is safe or safe-with-allowed-warnings
- no active maintenance lock blocks filesystem writes
- no per-artist/per-release policy says manual review is required

When any check fails, the release enters `Needs help` or `Needs setup` with one
explicit reason and one recommended action.

Planned automation phases:

1. immediate discovery after wanted release creation
2. candidate auto-selection for high-confidence matches
3. candidate-scoped download execution
4. automatic transfer reconciliation after provider acceptance
5. failed-match blocking and next-match fallback
6. safe library add
7. post-add library verification and request fulfillment
8. automatic retry/rediscovery with clear exhaustion state
9. quality upgrade search until cutoff is reached, when enabled

---

## 14. Phased Task Plan

### Phase 0 - Design, Research, And Evaluation

Goal: finish the product and technical contract before touching code. This phase
decides what Harmoniarr should feel like, what language it uses, what state
means, and which existing implementation pieces can be reused.

- [x] Create this redesign plan.
- [x] Evaluate the current Activity workspace routes and classify each tab:
  user-facing timeline, Music Queue concern, Downloader concern, Artist Detail
  concern, Settings concern, or operator diagnostics.
- [x] Evaluate the existing Import Review/candidate services and decide which
  modules become internal evidence providers versus user-facing surfaces.
- [x] Review current source-selection, execution, transfer reconciliation,
  media inspection, spectral analysis, import apply, and recovery flows.
- [x] Research and document final references for Arr-style queue behavior,
  quality profiles, cutoff/upgrade semantics, download-client fallback, and
  user-friendly history surfaces.
- [x] Define user-facing language: `Music Queue`, `match`, `add to library`,
  `needs help`, `needs setup`, `quality choice needed`, and `try again`.
- [x] Define the fixed status/action enum and its user-facing label map.
- [x] Define quality profile terms, cutoff semantics, fallback rules, and
  verified-audio requirements.
- [x] Define the candidate hiding rule: candidates are internal evidence unless
  a release is stopped for match, quality, import, failure, or diagnostics.
- [x] Define Activity boundaries: event history, repair handoffs, and advanced
  diagnostics only.
- [x] Define Activity event names and payload shape for audio checked, audio
  warning, audio failure, suspicious FLAC, match failed/trying next, no matches
  left, and added-to-library outcomes.
- [x] Define match-attempt lifecycle: selected, failed, blocked, skipped, trying
  next, exhausted.
- [x] Define release-centered payload examples for the walkthrough states:
  clean setup, missing folder setup, ambiguous match, high-confidence match,
  failed-match fallback, FLAC required with lossy-only results, suspicious FLAC,
  ready to add, needs help adding, in library.
- [x] Update this document with final Phase 0 decisions before Phase 1 begins.

Phase 0 outcome:
[MUSIC_QUEUE_PHASE_0_DESIGN.md](MUSIC_QUEUE_PHASE_0_DESIGN.md).

Acceptance:

- Product terms are home-user friendly and do not expose `candidate`,
  `acquisition`, `source search`, or `import apply` in the happy path.
- Activity is documented as a timeline/history surface, not the operational
  control center.
- Music Queue, Activity, Downloader, Artist Detail, Library, and Settings each
  have one clear responsibility.
- The implementation team can build Phase 1 without re-litigating terminology or
  state semantics.

### Phase 1 - Refactor, Read Model, And Skeleton

Status: **Complete as a read-only foundation slice.** See
`MUSIC_QUEUE_PHASE_1_READ_MODEL_DESIGN.md`.

Goal: create the modular foundation without changing the user's main workflow
yet. This phase extracts a clean read model, status policy, quality policy,
match-attempt summary, presentation helpers, routes, and skeleton UI.

- [x] Add `src/server/acquisition/acquisition-pipeline-status-service.js` with
  pure status derivation.
- [x] Add `src/server/acquisition/acquisition-quality-policy-service.js` with
  pure quality eligibility, cutoff, fallback, and verified-audio derivation.
- [x] Include verified media evidence in quality eligibility when files have
  been downloaded or inspected.
- [x] Add match-attempt summary derivation from the existing wanted-release
  import review summary, including selection-readiness evidence for ambiguous,
  low-confidence, unscored, selected, and handoff-active matches. Detailed
  attempted/blocked/next-match lifecycle remains Phase 2/3 work.
- [x] Add `src/server/acquisition/acquisition-pipeline-store.js` with
  release-centered aggregate reads over wanted releases, discovery requests,
  candidate review summaries, download execution summaries, and setup blockers
  already exposed by the wanted-release read model. Transfer snapshots and
  import previews remain deeper Phase 2/3 enrichments.
- [x] Add `src/server/acquisition/acquisition-pipeline-service.js`.
- [x] Add `src/server/routes/acquisition-routes.js` with
  `GET /api/v1/acquisition/releases` and
  `GET /api/v1/acquisition/releases/:wantedReleaseId`.
- [x] Add route inventory entries and permission checks.
- [x] Add `src/client/lib/acquisition-pipeline-presentation.js`.
- [x] Add `src/client/lib/acquisition-quality-presentation.js`.
- [x] Add `src/client/composables/useMusicQueue.js`.
- [x] Add `src/client/views/MusicQueueView.vue` skeleton with loading, empty,
  needs-help/status, and generic error states.
- [x] Preserve the existing Import Review page behind diagnostics; do not delete
  it in this phase.
- [x] Add focused server tests for status and quality mappings.
- [x] Add route tests for permissions and response shape.
- [x] Add focused client tests for presentation helpers.

Acceptance:

- A monitored artist with ready wanted releases appears as Music Queue rows.
- Missing folder setup renders `needs setup`.
- Pending/ambiguous matches render `pick a match` / `needs help`.
- Lossless-required releases with only lossy matches render
  `quality choice needed`.
- Lossless-required releases with unverified/suspicious downloaded FLAC files
  render `quality choice needed` before library add.
- Import-pending candidates render `ready to add` or `needs help adding`.
- Applied candidates render `in library`.
- Failed matches with another acceptable match render `trying next match`.
- Exhausted matches render `needs help` or queued rediscovery with a plain
  reason.
- The skeleton page does not expose candidate IDs, source search IDs, run IDs,
  or raw provider state outside diagnostics.

### Phase 2 - New User-Facing Design And Core Logic

Status: **In progress.** UX/read-model, match-drilldown, release-scoped
match-action, quality-choice review, Search again, and fallback-quality slices
complete; see
`MUSIC_QUEUE_PHASE_2_UX_DESIGN.md` and
`MUSIC_QUEUE_PHASE_2_MATCH_DRILLDOWN_DESIGN.md`.
The match-action outcome is documented in
`MUSIC_QUEUE_PHASE_2_MATCH_ACTIONS_DESIGN.md`. The quality-choice review
outcome is documented in
`MUSIC_QUEUE_PHASE_2_QUALITY_CHOICE_REVIEW_DESIGN.md`. The Search again action
outcome is documented in
`MUSIC_QUEUE_PHASE_2_SEARCH_AGAIN_ACTION_DESIGN.md`. The fallback-quality action
outcome is documented in
`MUSIC_QUEUE_PHASE_2_FALLBACK_QUALITY_ACTION_DESIGN.md`.

Goal: flesh out the Music Queue experience and the user-facing logic. This phase
makes the new surface understandable and useful before enabling deeper
automation changes.

- [x] Replace the old `Download candidates` primary experience with Music Queue
  routing and page copy.
- [x] Decide whether Music Queue is top-level nav, a Home panel with `See all`,
  or both.
- [x] Add summary cards: `Waiting`, `Searching`, `Downloading`, `Ready to add`,
  `Needs help`, `Needs setup`.
- [x] Replace the inactive zero-state summary grid with a compact overview that
  prioritizes attention and active work; keep State and Type as progressive
  filters beside always-visible name search. See
  `MUSIC_QUEUE_SUMMARY_FILTER_HIERARCHY_DESIGN.md`.
- [x] Separate provider/setup repair, automatic waiting, and a truly clear
  queue without reintroducing dashboard cards. See
  `MUSIC_QUEUE_WAITING_EMPTY_STATE_DESIGN.md`.
- [x] Add release-centered rows/cards with artist, release, year/type, state,
  why, next action, last activity, progress, quality profile, and match
  attempt summary.
- [x] Reduce the normal release row to one state, bounded progress and quality
  facts, and one primary action; keep raw match evidence in the selected review
  panel. See `MUSIC_QUEUE_RELEASE_ROW_HIERARCHY_DESIGN.md`.
- [x] Rework the selected-release panel into current outcome, only the decision
  that can continue the release, and an accessible matching-and-quality
  disclosure. See `MUSIC_QUEUE_REVIEW_HIERARCHY_DESIGN.md`.
- [x] Add filters for artist/search text, state, and release type. Reason and
  last-activity filters remain follow-up work once release-scoped match events
  are present.
- [x] Add the match review drawer/panel behind `Review matches`.
- [x] Reuse existing candidate detail/preview data as simplified match evidence.
- [x] Replace candidate-level `select` / `reject` actions with release-scoped
  `Use this match` and `Reject match` actions in Music Queue.
- [x] Add release-scoped `Review quality choice` details.
- [x] Add release-scoped `Search again` / `Try again` action for stopped
  releases.
- [x] Distinguish automatic next-match and scheduled-search recovery from
  stopped no-match or failed-search recovery, with one focused retry action
  only for a stopped release. See
  `MUSIC_QUEUE_STOPPED_RELEASE_RECOVERY_DESIGN.md`.
- [x] Add release-scoped quality fallback action.
- [x] Keep Music Queue mutation feedback local to the selected release review,
  while reserving page-level feedback for Music Queue read failures. See
  `MUSIC_QUEUE_RELEASE_ACTION_FEEDBACK_DESIGN.md`.
- [x] Apply an authoritative release projection immediately after a successful
  Music Queue mutation and show one compact `Up next` statement for known
  automatic transitions while the normal queue refresh reconciles totals. See
  `MUSIC_QUEUE_RELEASE_ROW_TRANSITION_CLARITY_DESIGN.md`.
- [x] Show why automation did or did not choose a match at aggregate release
  level and in simplified per-match cards.
- [x] Show quality profile fit for each release: profile, decision, format
  evidence, and verification state. Per-match preferred/minimum/cutoff detail
  remains follow-up work.
- [x] Show basic quality profile fit for each match: preferred, minimum, and
  below-profile format evidence.
- [x] Show deep quality profile fit for each match: cutoff, fallback,
  verified/unverified, suspicious/transcoded.
- [x] Add setup handoffs: `Set up folders`, `Test Soulseek`, `Set up media
  tools`.
- [x] Keep advanced diagnostics accessible but visually secondary.

Acceptance:

- The page never says `Download candidates` or `Acquisition` as the primary
  title.
- The first viewport explains what Harmoniarr is doing without requiring
  candidate knowledge.
- Ambiguous and low-confidence states explain the stop condition.
- Quality mismatches explain preferred, minimum, cutoff, fallback, and
  verification state.
- A user can resolve a stopped release without understanding the candidate state
  machine.
- Rejected/held/internal statuses do not dominate the page.

### Phase 3 - Automation, Match Attempts, And Fallback

Status: **In progress.** The automatic match/download handoff and failed-match
retry slices are implemented; see
`MUSIC_QUEUE_PHASE_3_AUTO_MATCH_DOWNLOAD_HANDOFF_DESIGN.md` and
`MUSIC_QUEUE_PHASE_3_FAILED_MATCH_RETRY_DESIGN.md`.

Goal: make the system proceed automatically through search, match choice,
download, failed-match blocking, next-match fallback, transfer reconciliation,
and rediscovery.

- [x] Add automatic match selection using desired format, minimum quality,
  release identity, track match, folder completeness, peer health, source-user
  trust, prior failures, and import safety. This first slice uses existing
  composite scoring and release quality policy; durable prior-failure/import
  safety ranking remains follow-up work.
- [x] Extend execution service to start a run for one match/candidate by passing
  the selected candidate id through the existing execution run summary.
- [x] Keep shared selected-queue execution for advanced/manual batch use.
- [x] Auto-download high-confidence releases using the candidate-scoped path.
- [x] Auto-download only matches that satisfy quality policy.
- [x] Block auto-download before provider enqueue when folder setup is missing.
- [x] After validated folder setup is saved, release only the bounded automatic
  requests stopped by that folder gate and start one ordinary discovery run.
- [x] Prove in a Docker-backed browser that a resumed automatic search reaches
  a policy-compliant downloading release and Downloader without candidate
  navigation, while strict quality and disabled-provider stops keep that
  handoff unavailable. See
  `MUSIC_QUEUE_AUTOMATIC_DOWNLOAD_HANDOFF_BROWSER_VERIFICATION_DESIGN.md`.
- [x] Exclude matches blocked by failed download or operator rejection from
  automatic recovery.
- [x] On failed download execution, keep the failed match terminal and attempt
  the next acceptable match automatically.
- [x] Surface automatic next-match and scheduled-search recovery separately
  from stopped releases, without exposing a retry control while Harmoniarr is
  still progressing automatically. See
  `MUSIC_QUEUE_STOPPED_RELEASE_RECOVERY_DESIGN.md`.
- [x] Persist bounded trigger evidence for match selected, match failed,
  skipped-by-quality, trying next, exhausted, and rediscovery queued in existing
  discovery/execution evidence.
- [ ] Extend the same failed-match retry behavior to timeout, disappeared
  source, failed quality verification, and import blocker outcomes.
- [ ] Add automatic retry/rediscovery when no acceptable matches remain and
  retry policy allows another search.
- [ ] Keep active-run conflicts clear and non-noisy.

Acceptance:

- A high-confidence release queues exactly its chosen match.
- A FLAC-required release does not auto-download an MP3 match.
- A failed match is not retried immediately when another acceptable match exists.
- The next acceptable match is selected automatically.
- Exhausted matches show `No good matches left. Harmoniarr will search again
  later.`
- Existing selected queue remains available in diagnostics.

### Phase 4 - Verified Audio Quality And Safe Library Add

Status: **In progress.** The safe automatic add-to-library handoff, first
verified-quality gate, cached pre-add spectral proof, first Music
Queue/Activity surfacing slice, and quality-stop recovery automation are
implemented; see
`MUSIC_QUEUE_PHASE_4_SAFE_AUTO_ADD_HANDOFF_DESIGN.md` and
`MUSIC_QUEUE_PHASE_4_VERIFIED_QUALITY_AUTO_ADD_GATE_DESIGN.md`, and
`MUSIC_QUEUE_PHASE_4_CACHED_SPECTRAL_PRE_ADD_PROOF_DESIGN.md` and
`MUSIC_QUEUE_ACTIVITY_SURFACING_DESIGN.md` and
`MUSIC_QUEUE_QUALITY_STOP_RECOVERY_AUTOMATION_DESIGN.md`.

Goal: make `FLAC` and other quality choices truthful before Harmoniarr claims a
release is complete.

- [x] Define safe add-to-library policy for the first backend slice: automatic
  add processes only clean `ready` candidates, while warning and blocked
  candidates remain stopped for review.
- [x] Require verified audio-quality evidence before automatic library add for
  strict lossless profiles.
- [x] Wire ffprobe evidence into the quality policy: codec, container, bitrate,
  sample rate, bit depth, channel count, duration, and tags.
- [x] Wire spectral verdicts into strict lossless decisions:
  authentic, suspicious, transcoded, inconclusive.
- [x] Use cached content fingerprints before repeating expensive spectral
  analysis.
- [x] Stop strict lossless auto-add when any required file is lossy, suspicious,
  transcoded, probe-failed, or unverified beyond policy.
- [x] Auto-start add-to-library/apply for ready matches that meet the first
  safe policy slice.
- [x] Surface strict-quality safe-auto stops in Music Queue and Activity with a
  release review deep link.
- [x] Block strict-quality failed downloaded matches and automatically promote
  the next quality-eligible match when one exists.
- [x] Preserve the durable wanted-release correlation when the safe apply worker
  records a library add, so the final outcome joins the normal Music Queue
  Activity story rather than becoming an unrelated candidate event. See
  `MUSIC_QUEUE_POST_TRANSFER_LIBRARY_ADD_BROWSER_VERIFICATION_DESIGN.md`.
- [ ] Route collisions, lossy decisions, suspicious FLAC, probe failures, and
  unsafe import plans to `needs help`.
- [ ] Add `Add to library` for manual safe adds.

Acceptance:

- Completed downloads add to the library without manual runway steps when safe.
- Unsafe adds stop with one clear reason and one action.
- Suspicious or unverified lossless files stop with `Quality choice needed`.
- A FLAC-required release does not auto-add an unverified or suspicious FLAC.
- Apply runs remain auditable.

### Phase 5 - Activity Overhaul And Diagnostics Migration

Goal: make Activity a readable history, not the place users go to run the
system. Move old workbenches into diagnostics and link timeline events to the
right repair surface.

- [x] Collapse Activity default view into a timeline/event-history first
  experience. See `ACTIVITY_TIMELINE_NAVIGATION_DESIGN.md`.
- [x] Add compact timeline filters for all activity, downloads, audio checks,
  library, requests, artist policy, and terminal attention states.
- [x] Emit the first Music Queue lifecycle set for search queued, retrying a
  download, trying the next match, no matches left with rediscovery scheduled,
  and terminal download failure. See
  `MUSIC_QUEUE_ACTIVITY_LIFECYCLE_DESIGN.md`.
- [x] Add compact Music Queue release progress to Home and monitored Artist
  Detail, with scoped review/setup handoffs and no duplicate workflow controls.
  See `MUSIC_QUEUE_PROGRESS_STRIP_DESIGN.md`.
- [x] Focus Home Music Queue progress on releases that are actively moving or
  need help, omit idle queue state, and use one direct release-detail handoff.
  See `MUSIC_QUEUE_HOME_PROGRESS_FOCUS_DESIGN.md`.
- [x] Focus the full Music Queue on current work by default, retain an explicit
  all-releases scope, and hand long-lived records to Activity History. See
  `MUSIC_QUEUE_CURRENT_WORK_FOCUS_DESIGN.md`.
- [x] Consolidate Music Queue status into its current-work header, suppress
  zero-value summary detail, and keep scheduled automatic searches secondary
  with an explicit handoff. See `MUSIC_QUEUE_STATUS_HIERARCHY_DESIGN.md`.
- [x] Simplify Settings with a setup-first landing page and progressive
  disclosure so routine connections, folders, and library behavior stay clear
  while specialist tuning remains available on request. See
  `SETTINGS_PROGRESSIVE_DISCLOSURE_DESIGN.md`.
- [x] Make Soulseek provider ownership explicit in Settings through Managed,
  External, and Disabled modes. Disabled mode prevents provider polling, while
  managed Compose secrets remain deployment-owned. See
  `SLSKD_PROVIDER_MODE_ONBOARDING_DESIGN.md`.
- [x] Add mode-aware provider recovery guidance: Managed setup shows only the
  documented Compose command and required secret filenames when its overlay is
  absent; External mode hands off to Media & storage for folder visibility and
  path translations. See `SLSKD_PROVIDER_MODE_RECOVERY_GUIDANCE_DESIGN.md`.
- [x] Add mode-aware Settings setup progress: a missing Managed overlay is
  described as a deployment step, not a generic unavailable connection, with
  one bounded handoff to Connections. See
  `SLSKD_PROVIDER_MODE_SETUP_PROGRESS_DESIGN.md`.
- [x] Add mode-aware provider repair context to Home and Music Queue when
  provider-dependent music cannot advance. The shared notice gives one concise
  cause and Connections handoff without surfacing configuration controls. See
  `MUSIC_QUEUE_PROVIDER_REPAIR_CONTEXT_DESIGN.md`.
- [x] Confirm provider repair recovery after a Connections save that originated
  from Music Queue. The safe, bounded result states eligibility to continue and
  offers a return link only after a verified healthy check. See
  `MUSIC_QUEUE_PROVIDER_REPAIR_RECOVERY_CONFIRMATION_DESIGN.md`.
- [x] Surface bounded Music Queue recovery visibility after a verified provider
  repair. The fixed return token triggers one queue refresh, reports only the
  first release already waiting for the normal search cycle, and is consumed
  from the URL without dispatching work. See
  `MUSIC_QUEUE_PROVIDER_RECOVERY_VISIBILITY_DESIGN.md`.
- [x] Record one Music Queue Activity row when a release that was waiting on
  Soulseek actually starts searching again after provider recovery. The durable
  per-release marker survives restarts, is consumed only after provider search
  acceptance, and exposes no provider diagnostics. See
  `MUSIC_QUEUE_NORMAL_CYCLE_ACTIVITY_VISIBILITY_DESIGN.md`.
- [x] Coalesce normal automatic Music Queue milestones into bounded,
  release-centered Activity stories while retaining durable raw events,
  explicit-action/retry boundaries, final outcomes, and safe handoffs. See
  `MUSIC_QUEUE_ACTIVITY_EVENT_COALESCING_DESIGN.md`.
- [x] Reduce normal Activity visual noise without changing the event contract:
  replace the seven-pill filter bar with a labeled native select, reserve row
  badges for repair states, place freshness beside Refresh, and render
  Advanced diagnostics after the normal timeline. Desktop and mobile browser
  verification covers the resulting hierarchy. See
  `ACTIVITY_INFORMATION_HIERARCHY_DESIGN.md`.
- [x] Extend Activity events for match selected, download started, audio
  checked/warning/failed, suspicious FLAC, added-to-library, and request
  fulfilled as those lifecycle states become release-centered. See
  `MUSIC_QUEUE_ACTIVITY_REPAIR_HANDOFFS_DESIGN.md`.
- [x] Emit the first strict-quality stop Activity event and link it to Music
  Queue release review.
- [x] Add the first repair handoffs from Activity to Music Queue, Library,
  Request Detail, and Settings Connections. See
  `MUSIC_QUEUE_ACTIVITY_REPAIR_HANDOFFS_DESIGN.md`.
- [x] Move current candidate/import/apply/runway controls behind operator-only
  advanced diagnostics. Canonical diagnostics routes now make the boundary
  explicit while legacy URLs redirect with preserved diagnostic state. See
  `ACTIVITY_ADVANCED_DIAGNOSTICS_BOUNDARY_DESIGN.md`.
- [x] Preserve old candidate/import links as diagnostics routes while normal
  Activity, Music Queue, Downloader, Library, and notification handoffs use
  release-oriented destinations and language.
- [x] Refocus Match diagnostics on one current recovery state and one safe
  repair, with raw paths, file rows, and collision evidence behind a native
  disclosure. Direct diagnostic-file routes still open and focus the relevant
  evidence row. See `MATCH_DIAGNOSTICS_RECOVERY_FIRST_DESIGN.md`.
- [ ] Remove Music Queue from the normal Activity tab mental model; Activity
  should link to Music Queue when a timeline item needs that context.
- [ ] Update product copy so Activity never presents itself as the primary
  download workflow.

Acceptance:

- Activity loads as timeline/event history.
- Activity events are easy to read and diagnose.
- Activity actions are minimal: `View`, `Try again`, `Set up folders`,
  `Set up media tools`, `Open Music Queue`, `Open Downloader`, `Open Library`.
- Normal users are not asked to operate candidate/import workbenches from
  Activity.

### Phase 6 - Migration, Cleanup, And Documentation

Goal: complete the transition without breaking existing diagnostics, routes, or
walkthrough setup.

- [ ] Keep Import Review diagnostics available while Music Queue proves out.
- [ ] Convert primary navigation and user-facing links to Music Queue.
- [ ] Convert candidate links to release/match links where possible.
- [ ] Remove or narrow old primary candidate copy after browser tests prove the
  new release-centered flow.
- [ ] Update `LOCAL_DOCKER_WALKTHROUGH.md` for folder setup, Soulseek setup,
  media tools, Music Queue, Activity timeline, and expected automatic behavior.
- [ ] Update `IMPLEMENTATION_TASK_LIST.md` after each completed slice.
- [ ] Update route names, test names, and docs to keep public copy aligned with
  the language contract.
- [ ] Keep backend module names precise where useful, but keep UI copy
  home-user friendly.

Acceptance:

- The walkthrough no longer requires the user to interpret raw candidates for
  the normal path.
- Docs explain where to look for live downloads, library progress, Activity
  history, and diagnostics.
- Legacy diagnostics remain available for operators until removal is safe.

### Phase 7 - Browser, Docker, And End-To-End Proof

Goal: prove the whole path from monitored artist to library add, including
failure and repair paths, in browser and local Docker walkthrough conditions.

- [ ] Browser proof: clean setup, add monitored artist, release enters Music
  Queue.
- [ ] Browser proof: discovery produces matches and high-confidence match
  auto-advances.
- [ ] Browser proof: missing folder setup blocks early with `Set up folders`.
- [ ] Browser proof: FLAC-required release with only lossy matches stops with
  `Quality choice needed` and actionable fallback copy.
- [ ] Browser proof: FLAC-required downloaded file with suspicious/unverified
  analysis stops before library add.
- [ ] Browser proof: failed match is blocked, next acceptable match starts, and
  Activity records the fallback in plain language.
- [x] Browser proof: downloaded strict-quality failure blocks the bad match,
  promotes the next quality-eligible match, and keeps Music Queue moving. See
  `MUSIC_QUEUE_STRICT_QUALITY_RECOVERY_BROWSER_VERIFICATION_DESIGN.md`.
- [x] Browser proof: completed download moves through `Ready to add`,
  `Adding to library`, and `In library` without a diagnostic handoff; the
  completion, download, and verified-audio events are one compact release
  story. See `MUSIC_QUEUE_POST_TRANSFER_LIBRARY_ADD_BROWSER_VERIFICATION_DESIGN.md`.
- [x] Browser proof: Activity history loads as timeline/event history and links
  to Music Queue/Downloader/Library rather than requiring workbench navigation.
  See `ACTIVITY_HISTORY_INITIAL_LOAD_BROWSER_VERIFICATION_DESIGN.md`.
- [x] Browser proof: verified audio-quality events appear in Activity with clear
  summaries and repair handoffs, while an unsafe claimed-lossless result has no
  library action and offers only release-scoped quality review. See
  `MUSIC_QUEUE_POST_TRANSFER_LIBRARY_ADD_BROWSER_VERIFICATION_DESIGN.md`.
- [x] Docker walkthrough proof: one monitored artist completes the full flow or
  stops at a known external-network reason with clear copy. A connected external
  provider dispatched five automatic searches and produced the bounded Music
  Queue retry state when no acceptable result was ingested. See
  `EXTERNAL_DOWNLOAD_PATH_READINESS_DESIGN.md`.
- [ ] Focused server, client, integration, and browser tests are run for the
  changed surfaces.
- [ ] Broader validation is run before commit when code changes are substantial.

Acceptance:

- The normal path works without manual candidate selection.
- Every stopped release has a visible reason and next action.
- Activity is useful for diagnosis but not required to operate downloads.
- The local walkthrough can demonstrate the redesigned behavior end to end.

---

## 15. Migration Strategy

Do not delete Import Review immediately.

1. Ship the new read model and Music Queue page while the old Import Review
   components remain available.
2. Route primary music workflow navigation to Music Queue.
3. Move the current Import Review page behind an `Advanced diagnostics` route or
   panel.
4. Convert candidate links to release/match links where possible.
5. Remove or narrow old primary candidate copy after browser tests prove the new
   release-centered flow.
6. Rework Activity as an event-history and diagnostics area after Music Queue
   owns release progress.

This avoids destabilizing existing execution/apply diagnostics while letting the
user-facing workflow become automation-first.

---

## 16. Closed Design Decisions

The architecture-impacting open questions are closed in
[MUSIC_QUEUE_OPEN_QUESTIONS_DECISIONS.md](MUSIC_QUEUE_OPEN_QUESTIONS_DECISIONS.md).

Accepted decisions:

- Music Queue is the primary release-progress surface.
- Wanted remains the durable ledger; candidates move to diagnostics.
- Music Queue should be a top-level route, with an optional Home summary panel.
- Activity defaults to a timeline/history view with filters.
- Operational Activity tabs move to Music Queue, Downloader, Settings, Artist
  Detail, Library, or advanced diagnostics.
- Default quality profiles are `lossless_archive`, `high_quality`, and
  `any_available`.
- Fallback below preferred quality is profile-level first, with per-release
  override later.
- Cutoff quality keeps upgrade search eligible when `upgradeAllowed` is true.
- Provider health gates search; folder setup gates download handoff.
- Automatic library add is globally allowed only for safe states, and remains
  blocked by profile/library safety rules.
- Low-confidence results stop as `pick_match`; they are not auto-rejected by
  TTL in Phase 1.
- Raw candidate diagnostics are operator-only. Requesters may see simplified
  match history through request/release context.

Deferred UI decisions:

- match detail layout: route-backed page first, drawer or inline expansion can
  be decided during Phase 2
- how long legacy Import Review runway remains visible by default
- whether Wanted survives as a visible secondary page after Music Queue proves
  the workflow

---

## 17. Point-By-Point Working Order

Work this document in order, without continuing to patch Issue #4:

1. Reference operating model: confirm the Arr-style mental model and which terms
   Harmoniarr should expose.
2. Candidate role and simplification boundary: lock the rule that users manage
   releases and Harmoniarr manages candidates.
3. User-friendly language: lock the Music Queue labels and remove normal-path
   `acquisition`, `candidate`, `source`, and `import apply` wording.
4. Activity boundary: define Activity as event history and diagnostics, not a
   download workbench.
5. Quality profile and cutoff model: lock the default profiles and FLAC behavior.
6. New top-level experience: agree on page title, summary cards, row shape, and
   what disappears into diagnostics.
7. Release-centered state model: implement/read-test the status projection.
8. Button redesign: replace every internal verb with an outcome-oriented action.
9. Backend architecture: build the read model and quality policy services.
10. UI architecture: introduce Music Queue as the primary workflow.
11. Automation policy: enable automatic match selection, download, and safe
   library add behind setup and quality gates.
12. Phased task plan: execute one slice at a time with focused tests and browser
   walkthrough proof.

---

## 18. Current Slice And Next Step

Completed follow-up reliability slice:

- Automatic download folder readiness now runs before automatic match selection
  and again before execution-run creation. It requires validated download,
  staging, and library roots plus an explicit reachable slskd path mapping.
- Folder failures keep discovered matches as evidence, prevent selected or
  enqueued transfer state, and project as the existing `Needs setup` / `Set up
  folders` release action without exposing raw infrastructure details.
- The detailed design and validation contract is
  [MUSIC_QUEUE_AUTOMATIC_DOWNLOAD_FOLDER_READINESS_DESIGN.md](MUSIC_QUEUE_AUTOMATIC_DOWNLOAD_FOLDER_READINESS_DESIGN.md).
- A successful, relevant folder-settings save now rechecks that same
  server-side readiness contract and requeues only a bounded batch of
  automatic requests carrying `missing_download_folder` or
  `download_folder_unavailable`. It removes only that stale evidence and
  starts one ordinary discovery run, while quality stops, terminal search
  exhaustion, provider recovery, manual work, and download-recovery work stay
  untouched.
- The recovery design and security boundary are documented in
  [MUSIC_QUEUE_FOLDER_SETUP_RECOVERY_DESIGN.md](MUSIC_QUEUE_FOLDER_SETUP_RECOVERY_DESIGN.md).
- Media & storage now confirms a successful bounded recovery in its existing
  save area and browser coverage proves `Set up folders` -> validated save ->
  automatic search without candidate work. The confirmation design and browser
  contract are documented in
  [MUSIC_QUEUE_FOLDER_SETUP_RECOVERY_CONFIRMATION_BROWSER_VERIFICATION_DESIGN.md](MUSIC_QUEUE_FOLDER_SETUP_RECOVERY_CONFIRMATION_BROWSER_VERIFICATION_DESIGN.md).

Completed automatic handoff confidence slice:

- A Docker-backed browser contract now proves Music Queue moves from
  `Searching` to `Downloading` after a policy-compliant selection and hands the
  user to a visible live Downloader transfer without diagnostic navigation.
- The same contract proves a strict lossless quality stop and a disabled
  provider remain out of Downloader and show one clear user-facing action.
- The detailed design and validation boundary are documented in
  [MUSIC_QUEUE_AUTOMATIC_DOWNLOAD_HANDOFF_BROWSER_VERIFICATION_DESIGN.md](MUSIC_QUEUE_AUTOMATIC_DOWNLOAD_HANDOFF_BROWSER_VERIFICATION_DESIGN.md).

Completed post-transfer confidence slice:

- A Docker-backed browser contract now proves a verified completed transfer
  moves from `Ready to add` through `Adding to library` to `In library` without
  sending the user to Import Review diagnostics.
- The safe apply worker now carries the durable wanted-release ID into its
  bounded `release_added` event. Activity can therefore combine completion,
  download, audio verification, and library add into one release story even
  though the add worker operates on an import candidate.
- The unsafe branch proves a claimed lossless file that cannot be verified stops
  at the release, exposes `Review quality choice`, and never exposes an
  `Open Library` action.
- The detailed design, sources, security boundary, and validation contract are
  documented in
  [MUSIC_QUEUE_POST_TRANSFER_LIBRARY_ADD_BROWSER_VERIFICATION_DESIGN.md](MUSIC_QUEUE_POST_TRANSFER_LIBRARY_ADD_BROWSER_VERIFICATION_DESIGN.md).

Completed release-progress browser acceptance slice:

- A Docker-backed browser contract now proves one release progresses from
  `Searching` through `Downloading`, `Ready to add`, `Adding to library`, and
  `In library` without candidate-first navigation.
- The normal row and release details use release-level language and safe
  handoffs. Candidate terminology and the diagnostics route remain absent until
  the operator deliberately expands matching and quality details.
- The provider-health fixture shared by Music Queue browser suites now lives in
  one modular helper, eliminating repeated route mocks while preserving the
  existing focused handoff and post-transfer checks.
- The design, sources, security boundary, and validation contract are recorded
  in [MUSIC_QUEUE_RELEASE_PROGRESS_BROWSER_ACCEPTANCE_DESIGN.md](MUSIC_QUEUE_RELEASE_PROGRESS_BROWSER_ACCEPTANCE_DESIGN.md).

Completed strict-quality recovery browser acceptance slice:

- A focused server contract now proves a strict-quality failure creates no
  follow-up execution run when no quality-eligible successor remains, keeping
  the release at a clear safe stop.
- A Docker-backed browser contract now proves the normal release view moves
  from `Trying another match` to `Downloading` after recovery, without manual
  candidate selection or diagnostic navigation.
- The same contract proves the exhausted branch remains `Quality choice needed`
  with only `Review quality choice`, no Downloader handoff, and release-scoped
  Activity links back to Music Queue.
- The design, sources, security boundary, and validation contract are recorded
  in [MUSIC_QUEUE_STRICT_QUALITY_RECOVERY_BROWSER_VERIFICATION_DESIGN.md](MUSIC_QUEUE_STRICT_QUALITY_RECOVERY_BROWSER_VERIFICATION_DESIGN.md).

Completed Activity-history initial-load browser acceptance slice:

- Direct `/app/activity` navigation and reload now retain a truthful first-load
  state: the timeline shows loading until its first bounded request settles,
  instead of briefly claiming there is no history.
- Advanced System history applies the same first-load protection and its direct
  route/reload is covered alongside the normal timeline.
- Browser coverage proves the normal filtered handoffs stay on Music Queue,
  Connections, Library, and Request Detail rather than candidate diagnostics.
- The design, sources, security boundary, and validation contract are recorded
  in [ACTIVITY_HISTORY_INITIAL_LOAD_BROWSER_VERIFICATION_DESIGN.md](ACTIVITY_HISTORY_INITIAL_LOAD_BROWSER_VERIFICATION_DESIGN.md).

Completed external download-path readiness slice:

- Live walkthrough validation distinguished a healthy external provider from
  import readiness: no saved source-to-Harmoniarr translation means automatic
  file work stops safely before provider paths are read locally.
- The same acceptance run found and corrected a PostgreSQL claim-lock defect
  that stopped automatic discovery before it could search the connected
  provider; the scoped lock preserves concurrent worker safety.
- The walkthrough now accepts a shell-only completed-download host-path
  override while preserving its disposable local default, and Media & storage
  gives the operator one focused setup action with Harmoniarr's path prefilled.
- The design, security boundary, portable deployment guidance, and safe
  file-backed validation strategy are recorded in
  [EXTERNAL_DOWNLOAD_PATH_READINESS_DESIGN.md](EXTERNAL_DOWNLOAD_PATH_READINESS_DESIGN.md).

Recommended next slice:

1. supply the external provider's completed-download host mount and matching
   source prefix through the documented walkthrough override and path
   translation;
2. capture one provider-acceptance evidence record for a normal Music Queue
   release, without requiring a real download as a test fixture;
3. use the deterministic Docker file-backed Music Queue validator to prove
   quality verification and safe library add, then automate only the specific
   gap the live acceptance evidence exposes.

Reason: the normal release journey, strict-quality recovery, file/worker
boundary, Activity-history read path, and external-path setup guidance are now
covered. The remaining high-value risk is live provider acceptance across the
operator's mounted path and external search results, not unbounded candidate
or import workbench behavior.
### Controlled Provider Acceptance Proof

Implemented in [CONTROLLED_PROVIDER_PIPELINE_E2E_DESIGN.md](CONTROLLED_PROVIDER_PIPELINE_E2E_DESIGN.md). It covers real discovery, automatic selection, enqueue, transfer reconciliation, quality verification, library add, and cleanup without relying on live peer content.

The same controlled proof now includes a terminal failed-transfer branch: the
high-ranked match remains failed, the next eligible match is promoted, and the
fallback completes download, verification, and safe automatic library add with
no candidate-first navigation. This protects the default Music Queue promise
while keeping bounded same-match retry behavior for rejected transfers.

### Terminal Transfer Recovery Visibility

Implemented in
[MUSIC_QUEUE_TRANSFER_RECOVERY_BROWSER_VERIFICATION_DESIGN.md](MUSIC_QUEUE_TRANSFER_RECOVERY_BROWSER_VERIFICATION_DESIGN.md).
Music Queue now revalidates only releases in active automatic progress states,
so a terminal transfer recovery visibly advances from `Trying another match` to
`Downloading` without a manual refresh. The browser contract keeps the normal
experience release-centered and verifies Activity offers only the focused Music
Queue handoff.

### Match Diagnostics Run History Boundary

Implemented in
[MATCH_DIAGNOSTICS_RUN_HISTORY_CONTROLS_DESIGN.md](MATCH_DIAGNOSTICS_RUN_HISTORY_CONTROLS_DESIGN.md).
The remaining media-check, download, and add-to-library run workbenches are
collapsed behind `Run history and controls`; direct run links expand that
boundary, and visible diagnostic language no longer presents candidate/import
worker terminology as the operator's primary task.

### Match Diagnostics Find Match Boundary

Implemented in
[MATCH_DIAGNOSTICS_FIND_MATCH_TOOL_DESIGN.md](MATCH_DIAGNOSTICS_FIND_MATCH_TOOL_DESIGN.md).
The fixed queue/filter rail is now one optional `Search saved matches` disclosure.
Direct candidate and file recovery routes continue to select and focus their
target without expanding an unrelated result list, while choosing an
alternative match closes the finder and returns to recovery.

### Match Diagnostics Current Automation Boundary

Implemented in
[MATCH_DIAGNOSTICS_CURRENT_AUTOMATION_DESIGN.md](MATCH_DIAGNOSTICS_CURRENT_AUTOMATION_DESIGN.md).
Selected-match and pending-library summaries now sit behind a closed native
`Current automation` disclosure with a Music Queue handoff. Status-only
selected and pending-library routes open that context, while direct
candidate/file routes retain the recovery-first view.

### Match Diagnostics Recovery Focus

Implemented in
[MATCH_DIAGNOSTICS_RECOVERY_FOCUS_DESIGN.md](MATCH_DIAGNOSTICS_RECOVERY_FOCUS_DESIGN.md).
The Match diagnostics header now communicates a compact route-aware recovery
focus instead of a visible-match total. Exact result counts remain inside the
optional saved-match search disclosure, leaving recovery as the default
diagnostic context.

### Match Diagnostics Filter Hierarchy

Implemented in
[MATCH_DIAGNOSTICS_FILTER_HIERARCHY_DESIGN.md](MATCH_DIAGNOSTICS_FILTER_HIERARCHY_DESIGN.md).
The saved-match search now keeps status and folder text in its primary form,
while raw saved-search references and source users live behind `More filters`.
Deep links with either source filter automatically reveal that active
restriction.

### Music Queue Match Decision Evidence

Implemented in
[MUSIC_QUEUE_MATCH_DECISION_EVIDENCE_DESIGN.md](MUSIC_QUEUE_MATCH_DECISION_EVIDENCE_DESIGN.md).
The previously shipped selected-review hierarchy keeps the release outcome and
next decision clear; actionable match cards now complete that hierarchy by
showing only quality, format, and track coverage before their existing action
controls. Score, transfer, source-health, and detailed quality evidence remain
on the same card through a native `Match details` disclosure. Evidence cards
inside the already-advanced outer disclosure retain their complete facts.

### Music Queue Release Action Feedback

Implemented in
[MUSIC_QUEUE_RELEASE_ACTION_FEEDBACK_DESIGN.md](MUSIC_QUEUE_RELEASE_ACTION_FEEDBACK_DESIGN.md).
Music Queue now retains a single bounded action result next to the selected
release review instead of emitting mutation banners above the whole queue.
Working and success results use polite status semantics; failures use an alert
without moving keyboard focus. Page-level feedback remains reserved for queue
read failures.

### Music Queue Release-Row Transition Clarity

Implemented in
[MUSIC_QUEUE_RELEASE_ROW_TRANSITION_CLARITY_DESIGN.md](MUSIC_QUEUE_RELEASE_ROW_TRANSITION_CLARITY_DESIGN.md).
Successful Music Queue mutations now apply their authoritative returned release
projection before the existing bounded list revalidation. Recognized automatic
states display one compact `Up next` statement in the release row, so a person
can see the scheduled handoff after closing the review without opening
diagnostics. Unknown, complete, and attention states do not receive inferred
automation messaging.

Recommended next slice: extend terminal match recovery to timeout,
disappeared-source, failed-quality-verification, and import-blocker outcomes,
promoting the next eligible match only when quality and import safety policy
allow it.
