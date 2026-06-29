# Music Queue Phase 4 Verified Quality Auto-Add Gate Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the Phase 4 slice that prevents strict lossless downloads
from being added to the library automatically unless Harmoniarr can verify the
downloaded audio with media-tool evidence.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| FFmpeg ffprobe documentation: https://ffmpeg.org/ffprobe.html | `ffprobe` exposes machine-readable stream and format metadata, including JSON output for automated inspection. | Safe automatic add uses ffprobe-derived codec, container, bitrate, sample rate, bit depth, channel count, and tag evidence from the existing apply preview. |
| FFmpeg filter documentation for `aspectralstats`: https://ffmpeg.org/ffmpeg-filters.html#aspectralstats | FFmpeg can derive spectral statistics from decoded audio. | Existing spectral verdicts block safe automatic add when they say a lossless file is suspicious or transcoded. Cached pre-add spectral proof remains the next deeper slice. |
| Sonarr quality profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Sonarr models accepted qualities, cutoffs, and upgrade behavior as explicit policy, not just search terms. | Harmoniarr treats profile minimums as gates. A strict lossless profile cannot be satisfied by filename or provider claims alone. |
| Radarr quality profile settings: https://wiki.servarr.com/radarr/settings#quality-profiles | Radarr reinforces quality profiles as an automation control plane. | Music Queue quality policy owns automatic add eligibility, while diagnostics retain lower-level candidate evidence. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Security-focused event logging should be useful for reconstruction without leaking secrets. | The apply run item stores bounded quality-gate blockers and messages, not provider credentials or raw remote payloads. |

---

## 2. Recommendations

1. Keep manual add behavior unchanged.
   The new rule applies only to `safe_auto` add-to-library runs started after a
   completed download.

2. Use the existing apply preview as the verification boundary.
   The preview already resolves source files, library targets, and ffprobe
   metadata. Reusing it avoids a second filesystem scan.

3. Require strict lossless evidence per file.
   For `lossless_archive`, every ready file must have usable ffprobe metadata
   with a lossless codec, no fatal media-inspection warning, and no strong
   delivery-quality signal such as codec/extension mismatch or implausibly low
   bitrate.

4. Treat suspicious spectral evidence as blocking when present.
   If existing metadata carries a `suspicious` or `transcoded` verdict, safe
   automatic add stops before moving files.

5. Keep expensive spectral proof cache-first and bounded.
   The follow-up cached pre-add proof slice now reuses sampled fingerprints
   before running bounded spectral analysis. See
   `MUSIC_QUEUE_PHASE_4_CACHED_SPECTRAL_PRE_ADD_PROOF_DESIGN.md`.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Let any clean apply preview auto-add | Simple and already implemented. | A fake or lossy `.flac` could be moved into the library and treated as satisfying lossless policy. | Rejected for strict lossless profiles. |
| Run full spectral analysis synchronously before every add | Strongest fidelity check before library add. | Expensive, slower, and risks turning the apply worker into a long-running decoder path. | Deferred to cached sidecar evidence. |
| Gate safe-auto with ffprobe plus existing quality signals | Fast, deterministic, uses current preview evidence, and blocks common fake-lossless cases. | It is not complete proof of original-master fidelity without spectral cache. | Adopted for this slice. |
| Block manual add with the same rule | Maximizes quality strictness. | Removes the operator escape hatch and changes existing diagnostics behavior. | Rejected for this slice. |

---

## 4. Final Recommendation Stack

- New backend service:
  `src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js`
- Apply worker integration:
  `safe_auto` mode evaluates the quality gate after rebuilding the apply preview
  and before moving files.
- Quality evidence:
  ffprobe metadata, inspection warning codes, Music Queue profile context,
  delivery-quality heuristics, and existing spectral verdicts when present.
- Run evidence:
  blocked safe-auto files remain `import_pending`, the apply run item records a
  `quality_blocked` snapshot, and the run summary includes
  `qualityBlockedCount`.
- Security:
  bounded blocker records only include file id, filename, reason code, and a
  plain message. No provider API keys, remote credentials, or raw provider
  response payloads are recorded.

---

## 5. Implementation Outcome

Implemented files:

- `src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js`
- `src/server/import-candidates/import-candidate-apply-worker.js`
- `src/server/import-candidates/import-candidate-module.js`
- `src/server/import-candidates/import-candidate-stage-summary.js`
- `test/server/import-candidate-safe-auto-add-quality-gate.test.js`
- `test/server/import-candidate-apply-worker.test.js`

Behavior:

- `Lossless archive` safe-auto add now blocks when ffprobe metadata is missing.
- `Lossless archive` safe-auto add now blocks lossy codecs and codec/extension
  mismatch before files move into the library.
- Existing suspicious/transcoded spectral verdicts block safe-auto add.
- Flexible profiles such as `high_quality` are not forced through the strict
  lossless gate in this slice.
- Manual apply remains available through diagnostics.

---

## 6. Follow-Up Outcome

Cached spectral proof before automatic add is implemented in
`MUSIC_QUEUE_PHASE_4_CACHED_SPECTRAL_PRE_ADD_PROOF_DESIGN.md`.

Remaining work is now user-facing surfacing: Music Queue and Activity should
explain strict-quality stops in plain language and link back to the right review
surface.
