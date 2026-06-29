# Music Queue Phase 2 Quality Choice Review Design

Status: **Implemented.**
Date: 2026-06-29

## Scope

This slice makes `Quality choice needed` readable in Music Queue without adding
a new policy-changing action yet. The goal is to explain why automation stopped
for a release and how each available match fits the selected quality profile.

Implemented outcome:

- quality profiles now expose cutoff, fallback, upgrade, and manual-review
  policy fields in the server quality policy service
- Music Queue release details show profile, preferred formats, minimum formats,
  cutoff formats, fallback policy, upgrade-search policy, observed evidence,
  bitrate evidence, verification requirement, download gate, and library gate
- per-match cards show observed format, preferred fit, minimum fit, cutoff fit,
  fallback state, and audio-check requirement
- `Quality choice needed` now includes a plain-language guidance sentence
- focused server and client tests cover the profile policy shape and Music
  Queue review projection

This intentionally does **not** add `Allow fallback quality`, `Search again`, or
`Try again` mutations. Those actions need their own audited server boundary.
The first retry boundary later landed in
`MUSIC_QUEUE_PHASE_2_SEARCH_AGAIN_ACTION_DESIGN.md`.

## Official Sources Reviewed

| Source | Relevant guidance | Design impact |
| --- | --- | --- |
| Servarr Sonarr quality-profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality profiles define allowed qualities, cutoff behavior, and upgrade goals. | Harmoniarr quality profiles need explicit preferred, minimum, cutoff, fallback, and upgrade metadata instead of only appending search terms. |
| Servarr Radarr quality-profile settings: https://wiki.servarr.com/radarr/settings#quality-profiles | Radarr uses the same profile/cutoff pattern for automatic media selection. | Music Queue should explain whether a match is acceptable, fallback, below cutoff, or still eligible for future upgrade. |
| FFmpeg ffprobe documentation: https://ffmpeg.org/ffprobe.html | ffprobe provides machine-readable stream/container evidence through structured output. | Quality review must distinguish provider/filename hints from actual media evidence and verification state. |
| W3C WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Status changes should be programmatically determinable without moving focus unnecessarily. | The quality guidance in the details panel uses status text and does not rely on color alone. |
| OWASP API Security - Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Object-scoped actions must re-check authorization and ownership. | The future fallback/try-again mutations must be release-scoped and re-check match/release ownership, as the existing `Use this match` and `Reject match` routes already do. |

## Recommendations

1. Keep quality policy as a pure server module.
   The server remains the source of truth for profile semantics. The client only
   presents bounded read-model fields.

2. Show quality mismatch as an exception state, not a raw candidate task.
   The user should see `Quality choice needed` with the reason and match fit,
   not be forced into the old candidate workbench.

3. Separate read-only review from policy mutation.
   Explaining fallback is safe in this slice. Allowing fallback changes
   automation behavior and must be audited separately.

4. Keep format claims distinct from verified audio.
   FLAC in a filename or provider result is not the same as verified lossless
   media evidence.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add explanation-only quality review first | Low risk, makes stopped releases diagnosable, does not change automation | Does not yet let the user resolve fallback in one click | Adopted |
| Add fallback mutation in the same slice | Faster visible resolution path | Mixes UI explanation with policy mutation, larger security/test surface | Deferred |
| Keep quality detail only in diagnostics | Smallest UI change | Preserves the current confusion: users cannot tell why Music Queue stopped | Rejected |
| Expose raw candidate payloads | Maximum detail for operators | Too noisy and leaks implementation vocabulary into the main workflow | Rejected |

## Final Recommendation Stack

- **Server policy:** `src/server/acquisition/acquisition-quality-policy-service.js`
  owns profile metadata and quality eligibility.
- **Client presentation:** `src/client/lib/acquisition-quality-presentation.js`
  owns quality labels and reusable formatting.
- **Music Queue projection:**
  `src/client/lib/acquisition-pipeline-presentation.js` builds release and
  match quality-review rows.
- **UI surface:** `src/client/views/MusicQueueView.vue` renders compact
  release-level and per-match quality details.
- **Validation:** focused server/client unit tests for the policy and
  presentation contract; broader validation before commit.

## Security Notes

- This slice adds no new write routes.
- Future fallback/try-again actions must require CSRF, fresh session, and
  release-scoped authorization checks.
- Quality details remain bounded to formats, profile state, and gate decisions;
  raw provider payloads, usernames, file paths, and secrets remain in
  diagnostics.

## Outcome

The user can now open a Music Queue release and answer:

- what quality profile is active
- what formats are preferred, minimum, and cutoff
- whether fallback is allowed
- whether upgrade search should continue
- what evidence Harmoniarr saw
- whether download and library-add automation are currently blocked
- why a specific match is preferred, fallback, below profile, or needs an audio
  check

## Next Slice

Implement the release-scoped quality fallback override:

1. `Allow fallback quality` for profiles where fallback is permitted or where an
   operator explicitly overrides a release
2. audited Activity events for quality choice, fallback accepted, fallback
   rejected, and rediscovery queued
3. re-evaluation of the release under the fallback policy before automatic
   download continues
