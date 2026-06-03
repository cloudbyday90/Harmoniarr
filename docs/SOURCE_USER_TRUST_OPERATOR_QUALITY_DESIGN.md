# Source-User Trust — Operator Ignore UI & Source-Level Quality Grading

Status: **Implemented.** This document records the design and outcome for the
**first two** of the "three more high-value design areas" closed out at the end of
[SOURCE_USER_TRUST_CLOSED_LOOP_DESIGN.md](SOURCE_USER_TRUST_CLOSED_LOOP_DESIGN.md) §7:

1. **Operator-facing trust & ignore UI** — an authenticated **Activity → Ignored**
   surface that turns the already-exposed ignore route dependencies into a usable
   workflow: a reputation-driven "suggested to ignore" table with one-click apply,
   a manual ignore form, an opt-in **auto-apply** toggle + cool-down, and a
   reviewable ignore list with un-ignore.
2. **Quality signal sources beyond the apply result** — derive **decode-free
   fidelity signals** (codec↔extension mismatch, lossless under-bitrate, low lossy
   bitrate, incomplete tags) from the apply preview's existing ffprobe metadata and
   fold them into the `quality_weight`, so fake/transcoded "lossless" deliveries are
   graded down **at the source** even when the apply itself succeeds cleanly.

Both items are **purely additive and backward-compatible**. No migration, no new
tables, and no schema-snapshot change were required: the quality columns and the
ignore table already exist (from the ledger and closed-loop phases), and every new
field defaults to its pre-change behaviour when absent.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories — no
assumed URLs. The **Tavily MCP remained unavailable** (invalid API key, consistent
with every prior phase), so all external facts were read through the **GitHub MCP**
(`github_repo` / `search_code`) against upstream projects that publish the
authoritative implementations, current as of the work date (2026).

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Fake / transcoded-FLAC detection | `Guillain-RDCDE/FLAC_Detective` — verdict tiers `FAKE_CERTAIN ≥ 86`, `SUSPICIOUS ≥ 55`, `WARNING ≥ 31`; bitrate red-flags `BITRATE_RED_FLAG = 160 kbps`, `CRITICAL = 128 kbps` | Confirms the two detection families: **heavy** spectral-cutoff analysis (decode + FFT) and **lightweight** metadata heuristics. We adopt only the lightweight, ffprobe-derivable signals on the apply path and defer the DSP family to a future offline sidecar. |
| MP3 cutoff signatures (corroboration) | "Fakin' the Funk?" methodology referenced by FLAC Detective — 128 kbps ≈ 16 kHz cutoff, 320 kbps ≈ 20.5 kHz | A lossy source re-encoded to FLAC sheds high-frequency content; without FFT we cannot read the cutoff directly, but the **bitrate ratio** of a genuine 16-bit/44.1 kHz FLAC (~500–1000 kbps, i.e. 30–70 % of uncompressed PCM) is a strong, cheap proxy. We treat `bitRate / (sampleRate·bitDepth·channels) < 0.30` as transcode-suspicious. |
| Codec ↔ container authenticity | ffprobe stream/format model (`codec_name`, `bits_per_raw_sample`, `sample_rate`, `channels`, `tags`) read from the existing inspection path | A lossless **extension** carrying a lossy **codec** (`.flac` decoding to `mp3`/`aac`/`opus`) is a *definitive* transcode — the single strongest decode-free signal, weighted highest. |
| One-click suggestion + reviewable list UI | Carried forward from the closed-loop phase: backend `applyIgnoreSuggestion` / `listIgnoredSourceUsers` / `removeIgnoredSourceUser` already exposed | The UI is a thin, auditable projection over those dependencies; the heuristic only *suggests*, the operator *decides* (or opts into auto-apply), preserving the "nudge but never own correctness" doctrine. |

**Why spectral analysis stays out of the hot path.** Full cutoff detection requires
decoding each track and running an FFT — seconds of CPU per file. The apply worker
runs synchronously on the request/operation path, so it must stay IO-light. The
lightweight signals above are computed from metadata **we already collected** during
the apply preview, adding effectively zero cost while still catching the most common
fakes. The DSP family is documented as a future sidecar in §7.

---

## 2. Design & outcome

### 2.1 Source-level delivery-quality grading (Item 2)

A new pure module, [`media-delivery-quality.js`](../src/server/media/media-delivery-quality.js),
grades the *fidelity* of applied files independently of *whether* they applied. It
performs no IO and has no side effects.

**Inspection metadata (additive).**
[`media-inspection-service.js`](../src/server/media/media-inspection-service.js)
now returns four additional ffprobe-derived fields alongside the existing ones —
`bitDepth` (`bits_per_raw_sample ?? bits_per_sample`), `channelCount`, `sampleRate`,
and a normalized lowercase `tags` object (merged from `format.tags` and the primary
audio stream tags). All existing fields are unchanged; the inspection tests assert at
the field level, so the additions are safe.

**Signals and penalties** (`assessFileDeliveryQuality({ filename, metadata })`):

| Signal | Trigger | Penalty |
| --- | --- | --- |
| `codec_extension_mismatch` | lossless extension carrying a lossy codec | 0.60 |
| `lossless_low_bitrate` | lossless codec whose `bitRate / uncompressed PCM < 0.30` | 0.40 |
| `low_bitrate` | lossy codec under 192 kbps | 0.20 |
| `incomplete_tags` | missing any of artist / album / title | 0.10 |

`.m4a` is deliberately **not** treated as a lossless promise on its own (it is
overloaded between ALAC and AAC) — the codec decides. The per-file penalty is the sum
of fired signals, clamped to `[0,1]`.

**Aggregation** (`assessDeliveredQuality({ files })`): the candidate's penalty is the
**maximum per-file penalty** (a single fake file taints the delivery) and the **union**
of all signals, plus an `assessedFileCount`.

**Folding into reputation.**
[`source-user-outcome-quality.js`](../src/server/activity/source-user-outcome-quality.js)'s
`classifyApplyOutcomeQuality` takes an optional `deliveryQuality` argument. An
otherwise-clean apply with a non-zero delivery penalty is now **downgraded** (and
labelled by its dominant signal); for warned/partial applies the delivery penalty is
subtracted from the completion ratio. The degraded result never drops below the
`MIN_DEGRADED_QUALITY_WEIGHT = 0.25` floor — the files did land — and the signals are
merged into the human-readable `reason`.

**Wiring.** [`import-candidate-apply-worker.js`](../src/server/import-candidates/import-candidate-apply-worker.js)
computes `assessDeliveredQuality({ files: applyPreview.files })` for applied candidates
and passes it through to the classifier. The reputation ledger therefore records peers
that ship fake/transcoded FLAC as lower-quality successes, which flows into the
download scorer exactly like the existing partial/transcode penalties.

### 2.2 Operator ignore UI (Item 1)

**Reputation → suggestions projection.**
[`source-user-trust-evidence-service.js`](../src/server/activity/source-user-trust-evidence-service.js)
gains `listSourceUserAutoIgnoreSuggestions()`, a route-friendly serializer that walks
the (Map-shaped) reputation index and returns a JSON array of peers the auto-ignore
heuristic currently flags — `{ username, trustState, successCount, failureCount,
recencyWeighted, suggestion: { reason, signals } }` — sorted by `failureCount`
descending. This avoids leaking the in-memory Map across the route boundary.

**Routes** (registered in [`activity-routes.js`](../src/server/routes/activity-routes.js),
mirrored in [`route-inventory.js`](../src/server/route-inventory.js)). Non-colliding
paths were chosen to avoid shadowing the existing `/source-users/:username` route:

| Method · Path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/v1/activity/ignored-source-users` | admin (read) | List current ignore entries (array wrapped as `{ ignoredSourceUsers }`). |
| `GET /api/v1/activity/source-user-ignore-suggestions` | admin (read) | Reputation-flagged peers to review. |
| `POST /api/v1/activity/ignored-source-users` | fresh-admin + CSRF + rate-limit | Apply an ignore (manual or one-click suggestion). |
| `DELETE /api/v1/activity/ignored-source-users/:username` | fresh-admin + CSRF + rate-limit | Un-ignore a peer. |

**Frontend.** A dedicated [`ActivityIgnoredView.vue`](../src/client/views/ActivityIgnoredView.vue)
(new **Activity → Ignored** tab) mirrors the blocklist view's structure:

- a **"Suggested to ignore"** table (username, trust, failures, reason, signals) with a
  one-click **Ignore** button per row;
- a **manual ignore** form;
- an **Auto-apply** card — an enable/disable toggle and a cool-down (hours) input wired
  to the existing `acquisition.autoIgnoreEnabled` / `acquisition.autoIgnoreCooldownHours`
  settings via the settings API;
- a **reviewable ignore list** with local filter, provenance pill (Auto-applied /
  Operator), and a **Remove** action per row.

Supporting modules: api-client methods in
[`activity-api.js`](../src/client/lib/activity-api.js)
(`fetchIgnoredSourceUsers`, `fetchSourceUserIgnoreSuggestions`, `applyIgnoredSourceUser`,
`removeIgnoredSourceUser`); a [`useSourceUserIgnore`](../src/client/composables/useSourceUserIgnore.js)
composable; and a pure presentation module
[`source-user-ignore-presentation.js`](../src/client/lib/source-user-ignore-presentation.js).

---

## 3. Security

- **No new trust boundary.** Reads require an admin session; every mutation requires a
  **fresh** admin session **plus CSRF** plus the existing source-user mutation rate
  limiter — identical to the blocklist mutations. The route-inventory parity test and
  the rate-limit audit test both enforce this and pass.
- **Server-authoritative actor.** `actorUserId` is taken from `session.appUserId`, never
  from the request body, so audit provenance cannot be spoofed.
- **No injection surface.** The delivery grader is pure and string-typed; it reads only
  ffprobe-reported fields and never shells out or interpolates user input. Tag values are
  normalized to lowercase strings before comparison.
- **No PII expansion.** Suggestion signals expose only aggregate counts/ratios
  (sample size, decayed failure ratio, success upper bound) — no raw event payloads cross
  the route boundary.
- **Auto-apply stays default-OFF** and is governed by the existing validated
  `acquisition` settings namespace (`autoIgnoreCooldownHours` bounded `0…8760`).

---

## 4. Files changed

**Backend**
- `src/server/media/media-inspection-service.js` — additive `bitDepth`, `channelCount`, `sampleRate`, `tags` metadata.
- `src/server/media/media-delivery-quality.js` — **new** pure fidelity grader.
- `src/server/activity/source-user-outcome-quality.js` — `deliveryQuality` folding into `classifyApplyOutcomeQuality`.
- `src/server/import-candidates/import-candidate-apply-worker.js` — compute + pass delivery quality.
- `src/server/activity/source-user-trust-evidence-service.js` — `listSourceUserAutoIgnoreSuggestions()`.
- `src/server/activity/activity-module.js` — expose the new dependency.
- `src/server/routes/activity-routes.js` — four new ignore routes.
- `src/server/route-inventory.js` — parity entries for the four routes.

**Frontend**
- `src/client/lib/activity-api.js` — four api-client methods.
- `src/client/composables/useSourceUserIgnore.js` — **new** composable.
- `src/client/lib/source-user-ignore-presentation.js` — **new** presentation module.
- `src/client/views/ActivityIgnoredView.vue` — **new** view.
- `src/client/router.js`, `src/client/views/ActivityWorkspaceView.vue` — route + nav tab.

**Tests**
- `test/server/media-delivery-quality.test.js` — **new** (per-file + aggregate grading).
- `test/server/source-user-outcome-quality.test.js` — extended (`deliveryQuality` paths).
- `test/server/source-user-trust-evidence-service.test.js` — extended (`listSourceUserAutoIgnoreSuggestions`).
- `test/server/activity-routes.test.js` — extended (four ignore routes).
- `test/client/source-user-ignore-presentation.test.js` — **new**.

---

## 5. Validation

- `node --test` on every new/changed server and client test file — **all green** (64 tests).
- `test/server/route-inventory.test.js` and `test/server/rate-limit-audit.test.js` — pass
  (the four new routes are accounted for and rate-limited).
- `node scripts/check-copyright.js` — pass (all new files carry the GPL header).
- `npx eslint` on all changed files — clean.
- No migration / no schema-snapshot change (existing columns and ignore table reused).

---

## 6. Pros, cons & final recommendation

**Item 2 — delivery-quality grading**

| Option | Pros | Cons |
| --- | --- | --- |
| **Ffprobe-derivable signals (chosen)** | Zero extra IO (reuses preview metadata); catches the most common fakes (codec mismatch, transcode under-bitrate); pure + fully testable | Cannot detect a *spectral* transcode that preserves bitrate (rare); ratio heuristic is a proxy, not proof |
| Full spectral-cutoff DSP on apply path | Definitive transcode detection | Seconds of CPU per file on a synchronous path — unacceptable; needs decode dependency |
| Do nothing (binary apply outcome) | Simplest | Fake FLAC keeps a clean reputation; defeats the trust loop |

**Item 1 — operator ignore UI**

| Option | Pros | Cons |
| --- | --- | --- |
| **Dedicated Ignored view + suggestions endpoint (chosen)** | Clear operator workflow; reuses blocklist patterns; one-click apply with full audit; auto-apply opt-in | One more route + view to maintain |
| Bolt onto the existing Users table | Fewer files | Crowds an already-dense admin table; mixes "review trust" with "manage ignores" |
| API-only, no UI | Least work | Leaves the closed-loop dependencies unusable by operators |

**Final recommended stack:** adopt the **ffprobe-derivable delivery-quality signals**
(defer spectral DSP to an offline sidecar) folded into the existing `quality_weight`, and
ship a **dedicated Activity → Ignored view** backed by a reputation-suggestions endpoint
with one-click apply, a reviewable ignore list, and a default-OFF auto-apply toggle. This
keeps the apply path IO-light, the trust loop honest about fidelity, and the operator in
control — with no migration and no new trust boundary.

---

## 7. Three more high-value design areas

1. **Spectral-cutoff DSP sidecar.** ✅ **Implemented** — see
   [SOURCE_USER_SPECTRAL_TREND_DESIGN.md](SOURCE_USER_SPECTRAL_TREND_DESIGN.md). Build the
   *heavy* half of fake-FLAC detection as an asynchronous, off-path worker: decode each
   applied track, measure the high-frequency cutoff (e.g. 16 kHz ⇒ 128 kbps-sourced), and
   emit a definitive `transcode_confirmed` signal that augments — never blocks — the apply.
   This closes the gap the lightweight heuristics intentionally leave open, with a clear
   queue/back-pressure and result-merge contract.
2. **Per-peer delivered-quality trend visualization.** ✅ **Implemented** — see
   [SOURCE_USER_SPECTRAL_TREND_DESIGN.md](SOURCE_USER_SPECTRAL_TREND_DESIGN.md). Surface a
   small time-series on the source-user detail panel — quality-weight over the last N
   deliveries, signal mix (mismatch / under-bitrate / tags), and a sparkline — so operators
   can distinguish a peer that *degraded recently* from one that was *always poor*, informing
   whether to ignore, watch, or wait.
3. **Ledger & ignore lifecycle: retention, backup, export.** (Carried forward.) Decide and
   document whether `source_user_outcome_events` and `source_user_ignore_entries`
   participate in backup/restore scopes, add a scheduled `pruneOutcomeEvents` maintenance
   task tied to `maxAgeDays`, and define export/redaction semantics so the evidence log and
   ignore list have a first-class, governed lifecycle.
