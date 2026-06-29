# Music Queue Phase 4 Safe Auto Add Handoff Design

Status: **Implemented.**

Date: 2026-06-29.

This document records the first Phase 4 implementation slice for the Music Queue
pipeline: when Downloader reports a selected match as complete, Harmoniarr
should automatically queue a safe add-to-library operation instead of requiring
the operator to visit Import Review and press another runway button.

This slice does not remove Import Review diagnostics. It narrows the happy path:

`download completed -> import-pending candidate -> safe auto add run -> library add worker`

---

## 1. Official Sources Reviewed

| Source | Design input |
| --- | --- |
| Sonarr completed download handling: https://wiki.servarr.com/sonarr/settings#completed-download-handling | Completed download handling is an automatic import path driven by download-client state. Bad Docker paths and permissions are common blockers, so import must remain gated by path visibility and safe file operations. |
| Sonarr quality profiles: https://wiki.servarr.com/sonarr/settings#quality-profiles | Quality profiles define the target quality and upgrade cutoff. Harmoniarr should keep quality rules policy-driven instead of relying only on search text. |
| SABnzbd API reference: https://sabnzbd.org/wiki/advanced/api | Download clients expose queue/history state through APIs. Harmoniarr should observe transfer outcomes and keep its own durable release/match/add-to-library state. |
| slskd configuration docs: https://github.com/slskd/slskd/blob/master/docs/config.md | slskd download directories must exist and be writable. Harmoniarr must treat path visibility and folder setup as add-to-library prerequisites. |
| FFmpeg ffprobe docs: https://ffmpeg.org/ffprobe.html | `ffprobe` can select audio streams and expose stream/container metadata. Strict quality verification remains a separate Phase 4 gate before auto-add claims a release is complete. |
| OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | Application events should record action, context, and outcome while avoiding sensitive data and ensuring logging failures do not break the main operation. |

---

## 2. Recommendations

1. Treat completed download reconciliation as the trigger for add-to-library
   work, not as a place to mutate files directly.

2. Queue an operation run for add-to-library work so existing leases,
   maintenance locks, audit trails, and retry/recovery behavior remain in force.

3. Make automatic add stricter than manual add:
   - automatic mode processes only clean `ready` import-pending candidates
   - manual mode may still process `ready_with_warnings`
   - blocked and warning candidates remain available for review

4. Keep warning and blocker candidates out of the automatic run item list so the
   run evidence describes only what Harmoniarr actually attempted.

5. Preserve bounded reconciliation evidence:
   - whether a safe auto add run started
   - whether it was skipped because another run was active
   - whether it was skipped because no clean candidate was ready
   - whether a maintenance lock blocked the automatic handoff

6. Do not expose provider secrets, raw slskd responses, or raw filesystem
   payloads in the new operation summary.

---

## 3. Pros And Cons

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep requiring the operator to start Import Apply manually | Lowest code change. Keeps all existing diagnostics. | Breaks the expected automated Music Queue path after every completed download. | Reject for happy path. |
| Apply files directly inside transfer reconciliation | Fast and simple. | Bypasses operation leases, maintenance locks, audit boundaries, pause/retry behavior, and worker evidence. | Reject. |
| Queue a normal manual apply run after completion | Reuses existing operation runner. | Manual runs process warning candidates; that is too broad for automatic behavior. | Reject. |
| Add a `safe_auto` apply mode and queue it after completion | Reuses existing apply service/worker while making automatic behavior stricter than manual behavior. | Requires a small new service and operation-summary fields. | Adopt. |

---

## 4. Final Recommendation Stack

### Backend Stack

- `import-candidate-auto-apply-run-service.js`
  - starts a safe auto add run after completed download reconciliation
  - maps known skipped cases to bounded result reasons
- `import-candidate-apply-service.js`
  - accepts `applySafetyMode` and `triggerSource`
  - computes executable count differently for `safe_auto`
- `import-candidate-apply-run-store.js`
  - persists `applySafetyMode` and `triggerSource` in operation summary
- `import-candidate-apply-worker.js`
  - filters safe-auto runs to clean `ready` candidates only
  - leaves warning/blocker candidates untouched
- `import-candidate-execution-reconciliation-service.js`
  - starts safe auto add after a completed transfer reaches `import_pending`
  - returns bounded start/skip evidence

### Security Stack

- No new route or permission surface.
- No secret or raw provider payload is stored in the new summary fields.
- Existing maintenance lock write guards remain in the apply service.
- Existing operation queue leases remain the concurrency control point.
- Known skipped outcomes are explicit; unexpected failures still surface to the
  caller/test instead of being hidden.

### Validation Stack

- Service test proves safe-auto executable count ignores warning candidates.
- Worker test proves warning and blocked candidates are not processed in
  safe-auto mode.
- Reconciliation test proves completed transfer reconciliation starts safe auto
  add.
- Auto-apply service test proves known skipped outcomes are bounded.
- Operation queue handler test proves trigger metadata reaches the worker.

---

## 5. Outcome

Implemented a backend-safe automatic add-to-library handoff:

- completed transfer reconciliation still marks the candidate `import_pending`
- reconciliation then asks the new auto-apply service to start a safe run
- the safe run uses the existing apply operation queue
- safe-auto worker execution processes only clean `ready` candidates
- warning and blocked import-pending candidates remain stopped for review

This narrows one of the biggest manual gaps in the walkthrough without removing
the deeper quality verification work that still belongs to Phase 4.

---

## 6. Remaining Phase 4 Work

- Require verified audio-quality evidence before automatic add for strict
  lossless profiles.
- Stop strict lossless auto-add when ffprobe or spectral evidence is missing,
  suspicious, or transcoded.
- Emit Music Queue / Activity events for audio checked, audio warning, add
  started, add completed, and add blocked.
- Add browser proof for completed download -> automatic add-to-library -> in
  library.
