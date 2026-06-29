# Music Queue Phase 2 Fallback Quality Action Design

Status: **Implemented.**
Date: 2026-06-29

## Scope

This slice adds a release-scoped `Allow fallback quality` action for Music Queue
releases stopped at `Quality choice needed` because the best available evidence
is below the selected preferred quality.

Implemented outcome:

- `POST /api/v1/acquisition/releases/:wantedReleaseId/allow-fallback-quality`
- fresh-session and CSRF protection on the new route
- release ownership verification before any write
- fallback action allowed only for below-minimum quality stops, not unverified
  lossless claims
- bounded per-release quality override in `library_discovery_requests.evidence`
- rediscovery queued for the same release after the override is saved
- existing Library discovery dispatcher started or gracefully reused
- Activity event `quality_fallback_allowed`
- Music Queue details panel button and release-choice row

This does not change global profiles or artist policy. It records a decision for
one wanted release.

## Official Sources Reviewed

| Source | Relevant guidance | Design impact |
| --- | --- | --- |
| Servarr Sonarr quality-profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality profiles define allowed qualities, cutoff behavior, and upgrade goals. | Fallback must be explicit and preserve cutoff/upgrade semantics rather than silently changing the saved profile. |
| Servarr Radarr quality-profile settings: https://wiki.servarr.com/radarr/settings#quality-profiles | Automatic selection is driven by profile quality and cutoff rules. | Harmoniarr should treat fallback as a release decision feeding the same quality policy, not as a candidate-table shortcut. |
| FFmpeg ffprobe documentation: https://ffmpeg.org/ffprobe.html | ffprobe can provide structured stream/container evidence. | Allowing lossy fallback must not bypass verification for lossless claims; unverified FLAC remains a quality stop. |
| OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | State-changing browser requests need CSRF protection. | The fallback route follows the Music Queue mutation pattern: fresh session plus CSRF. |
| OWASP API Security - Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Object-scoped APIs must re-check authorization for every object id. | The service resolves the wanted release through the scoped Music Queue read path before writing by metadata release id. |

## Recommendations

1. Keep fallback release-scoped.
   The user is making an exception for one release, not weakening the artist
   policy or the global quality profile.

2. Preserve the cutoff.
   Accepting high-quality lossy fallback should keep the lossless cutoff visible
   so a future upgrade can still be pursued when profile policy allows it.

3. Do not bypass lossless verification.
   `Allow fallback quality` means MP3/AAC/Opus/Ogg may be acceptable when the
   bitrate floor is met. It does not mean an unverified FLAC claim is safe.

4. Record the decision in both evidence and Activity.
   Evidence powers the read model and automation. Activity answers the user
   question, "Why did Harmoniarr accept lower quality for this release?"

5. Reuse discovery dispatch.
   After saving the override, queue the release for existing discovery instead
   of calling slskd directly from the Music Queue action.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Per-release fallback override in discovery evidence | No schema change for override data, scoped to the release, immediately visible to the read model | Evidence JSON must stay bounded and documented | Adopted |
| Global profile change | Simple quality evaluation | Surprising; affects many releases when the user only meant one | Rejected |
| Candidate-level "use anyway" | Quick handoff from old Import Review concepts | Keeps candidate as the work object and bypasses release-level policy | Rejected |
| Treat unverified FLAC as fallback | Unblocks more cases | Unsafe; accepts a potentially fake lossless claim | Rejected |

## Final Recommendation Stack

- **Quality policy:** `src/server/acquisition/acquisition-quality-policy-service.js`
  applies the per-release fallback override while keeping lossless verification
  strict.
- **Service:** `src/server/acquisition/acquisition-pipeline-service.js`
  verifies release scope and quality state before writing.
- **Persistence:** `src/server/library/library-discovery-request-store.js`
  records `musicQueueQualityOverride` and queues rediscovery in one update.
- **Route:** `src/server/routes/acquisition-routes.js`
  exposes a CSRF-backed release mutation.
- **Activity:** `quality_fallback_allowed` records the user-visible decision.
- **Client:** `src/client/lib/acquisition-api.js`,
  `src/client/composables/useMusicQueue.js`, and
  `src/client/views/MusicQueueView.vue` expose the action from Music Queue.

## Security Notes

- Mutation requires fresh session and CSRF.
- Release ownership is checked through the scoped Music Queue read model before
  writing.
- The store writes by metadata release id only after the scoped wanted release
  is found.
- The action is rejected unless the release is currently stopped for a
  below-minimum quality choice.
- Provider payloads, source usernames, raw folder paths, and secrets are not
  stored in the fallback evidence or Activity event.

## Outcome

When Music Queue stops because a strict profile only found high-quality lossy
evidence, the user can choose `Allow fallback quality`.

The saved release override:

- allows high-quality lossy formats for that release
- keeps the preferred/cutoff quality visible
- keeps unverified lossless claims blocked for audio verification
- records Activity history
- queues the release for another discovery pass

## Next Slice

Move into Phase 3 automation:

1. automatically choose the best acceptable match after quality policy passes
2. queue exactly that match for download
3. block failed matches per release
4. try the next acceptable match automatically
