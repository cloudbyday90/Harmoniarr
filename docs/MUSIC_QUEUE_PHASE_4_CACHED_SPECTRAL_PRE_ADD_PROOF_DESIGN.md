# Music Queue Phase 4 Cached Spectral Pre-Add Proof Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the Phase 4 slice that makes strict lossless automatic
add-to-library depend on cached or freshly measured spectral proof before files
move into the library.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| FFmpeg filter documentation for `aspectralstats`: https://ffmpeg.org/ffmpeg-filters.html#aspectralstats | FFmpeg can derive spectral rolloff statistics from decoded audio frames. | Harmoniarr uses the existing bounded `ffmpeg` spectral analyzer to classify lossless-claimed files before safe automatic add. |
| FFmpeg ffprobe documentation: https://ffmpeg.org/ffprobe.html | ffprobe provides machine-readable stream metadata that identifies the declared audio codec and sample rate. | The spectral proof service receives ffprobe codec/sample-rate evidence from the apply preview before deciding whether spectral proof is required. |
| PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html | Durable queues should claim work without double-processing under concurrency. | Existing post-apply spectral jobs continue to use the queue. The pre-add gate stays synchronous but bounded and cache-first, so it does not create duplicate queue claims. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Logs and run evidence should support reconstruction without exposing secrets. | The safe-auto run records bounded spectral blocker codes/messages and content proof status, not provider credentials or raw remote response payloads. |
| Sonarr quality profile settings: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality policy controls automated media decisions rather than search text alone. | Strict `Lossless archive` add-to-library now requires actual codec evidence and spectral proof, not filename/provider claims. |

---

## 2. Recommendations

1. Keep the pre-add path cache-first.
   A sampled content fingerprint is derived before decoding. If the same file
   was already measured, Harmoniarr reuses the cached cutoff and skips ffmpeg.

2. Bound pre-add analysis.
   When the cache misses, the existing ffmpeg spectral analyzer runs through
   the same timeout, binary allowlist, max-buffer, and no-shell command boundary.
   The safe-auto gate evaluates files sequentially so an album does not launch
   many analyzer processes at once.

3. Cache raw measurements, not verdicts.
   Harmoniarr stores cutoff/frame-count/duration by content hash and recomputes
   the verdict using current thresholds. This keeps future threshold tuning
   accurate.

4. Fail closed for strict lossless automation.
   Missing file path, fingerprint failure, missing cache with no analyzer,
   analyzer failure, suspicious verdict, transcoded verdict, or unaccepted
   inconclusive verdict all stop safe automatic add.

5. Preserve operator escape hatches.
   Manual add remains diagnostics-controlled. This slice only blocks automatic
   add for strict lossless releases.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require an existing cached verdict only | No synchronous decode on safe-auto. | New downloads would stop until a separate queue processes them, delaying the normal path. | Rejected as the default path. |
| Always decode before add | Strong proof before moving files. | Repeats expensive work for duplicate files and makes large albums slower. | Rejected. |
| Cache-first, then bounded pre-add analysis | Proves new downloads before add while reusing existing measurements and avoiding analyzer bursts. | Safe-auto can wait for one bounded analyzer pass on cache miss. | Adopted. |
| Store verdicts in the cache | Faster read path. | Verdicts become stale when thresholds change. | Rejected; store raw measurements. |

---

## 4. Final Recommendation Stack

- `src/server/media/media-spectral-proof-service.js`
  - derives sampled content fingerprints
  - reads/writes `source_user_spectral_cache`
  - runs bounded ffmpeg spectral analysis on cache miss
  - classifies proof under current spectral thresholds
- `src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js`
  - requires accepted spectral proof for strict lossless safe-auto add
  - evaluates files sequentially
  - blocks suspicious/transcoded/unverified proof before library movement
- `src/server/import-candidates/import-candidate-module.js`
  - wires the proof service with the spectral cache store, file content hasher,
    and ffmpeg analyzer
- `src/server/app.js`
  - passes the runtime-configured spectral analyzer into the import candidate
    module so pre-add proof uses the same binary/tooling boundary as the
    post-apply sidecar

Security posture:

- no shell interpolation
- no provider secrets in run evidence
- bounded file reads for fingerprints
- bounded ffmpeg execution through the existing media command service
- fail-closed strict lossless automation

---

## 5. Implementation Outcome

Implemented files:

- `src/server/media/media-spectral-proof-service.js`
- `src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js`
- `src/server/import-candidates/import-candidate-apply-worker.js`
- `src/server/import-candidates/import-candidate-module.js`
- `src/server/app.js`
- `test/server/media-spectral-proof-service.test.js`
- `test/server/import-candidate-safe-auto-add-quality-gate.test.js`
- `test/server/import-candidate-apply-worker.test.js`

Behavior:

- Strict `Lossless archive` safe-auto add accepts authentic cached spectral
  measurements.
- Cache misses run bounded spectral analysis, write the raw measurement, and
  classify the result before library add.
- Transcoded/suspicious/unaccepted inconclusive measurements block safe-auto
  add.
- Missing fingerprinting, missing file path, and analyzer failure block
  safe-auto add.
- Flexible profiles still skip the strict lossless spectral gate.

---

## 6. Music Queue/Activity Surfacing Outcome

The first Music Queue/Activity surfacing slice is implemented in
`MUSIC_QUEUE_ACTIVITY_SURFACING_DESIGN.md`:

- `quality_blocked` safe-auto apply evidence now maps to Music Queue
  `Quality choice needed`.
- The release detail uses the quality-gate failure message where available.
- Activity records `music_queue_quality_blocked` with sanitized blocker detail.
- Activity links quality stops back to Music Queue release review instead of
  raw diagnostics.

Remaining follow-up:

1. add browser/Docker proof for the full quality-stop recovery path
2. add lower-noise Activity events for successful audio checks and warnings
3. keep manual fallback controls for stopped releases with no safe next match
