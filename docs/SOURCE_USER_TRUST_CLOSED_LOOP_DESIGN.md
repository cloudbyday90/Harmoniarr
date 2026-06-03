# Source-User Trust — Closed-Loop Auto-Ignore & Quality-Weighted Outcomes

Status: **Implemented.** This document records the design and outcome for the
**first two** of the "three more high-value design areas" closed out at the end of
[SOURCE_USER_TRUST_LEDGER_DESIGN.md](SOURCE_USER_TRUST_LEDGER_DESIGN.md) §7:

1. **Auto-ignore → settings + G6 closed loop** — surface the auto-ignore
   suggestion with a one-click apply, an **opt-in auto-apply policy** (with an
   audit trail and a cool-down), and feed accepted suggestions directly into
   G6's `candidate-source-filter` `ignoredUsernames`, completing the
   learn → act loop.
2. **Quality-weighted outcomes** — extend the outcome ledger to capture
   *delivered quality* (partial applies, transcode warnings, skipped files) so
   reputation reflects fidelity, not just completion, and the download scorer
   weights peers by the quality they actually deliver.

Both items are **purely additive and backward-compatible**. The existing trust
snapshot, manual blocklist, and lifetime counters are untouched; the ledger and
reputation model degrade bit-for-bit to their pre-change behaviour when the new
columns/settings are absent or at their defaults.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories — no
assumed URLs. The **Tavily MCP remained unavailable** (invalid API key,
consistent with every prior phase), so all external facts were read through the
**GitHub MCP** (`github_repo` / `search_code`) against upstream projects that
publish the authoritative implementations, current as of the work date (2026).

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Graded (non-binary) outcome accounting | `CIRISAI/CIRISAgent` · `ciris_engine/logic/services/governance/.../agent_credits.py` — credit outcomes graded `RESOLVED` / `PARTIAL` / `UNRESOLVED` rather than a binary pass/fail | A delivery outcome is rarely all-or-nothing. We keep the binary `outcome` for compatibility but add a **continuous `quality_weight ∈ [0,1]`** so a "success" can be a *partial* success and contribute proportionally to the reputation signal. |
| Cool-down / hysteresis on automated state flips | Standard control-systems hysteresis; in software this is the circuit-breaker "open → half-open" dwell time. A direct code search for `cooldown`-by-timestamp returned no novel pattern because it is a well-understood baseline. | An automated action that flips a peer into the ignore list must not *flap*. We gate auto-apply behind a **timestamp cool-down window** (`last_auto_evaluated_at + cooldownHours`) so a peer can only be auto-evaluated once per window. |
| Opt-in default-off automation with audit | Established least-surprise doctrine reinforced across the prior phases (Phase 3 "nudge but never own correctness"). | Auto-apply ships **default-OFF**. Every automated ignore writes an **audit event** with `actorType: 'system'`, so an operator can always see *why* a peer was ignored and reverse it. |
| Append-only evidence, projection on read | Carried forward from [SOURCE_USER_TRUST_LEDGER_DESIGN.md](SOURCE_USER_TRUST_LEDGER_DESIGN.md) (event log + derived projection) | `quality_weight` is just another **immutable column on the append-only event** — no read-modify-write, no lost-update race. The ignore list is a **separate table**, not a field on the trust-snapshot blob, to avoid entangling backup/restore semantics. |

**Why the ignore list is its own table, not a snapshot field.** The
operator-facing `recovery_trust_snapshots` blob is in the backup/restore scope
([BACKUP_RESTORE_DESIGN.md](BACKUP_RESTORE_DESIGN.md)) and is rewritten as a
whole document. Storing ignore entries there would (a) re-introduce the
lost-update race the ledger was built to avoid and (b) entangle restore
semantics. A dedicated `source_user_ignore_entries` table with a unique
`username_key` and `INSERT … ON CONFLICT … DO UPDATE` gives atomic, idempotent,
auditable ignore management independent of the snapshot lifecycle.

---

## 2. Design & outcome

### 2.1 Quality-weighted outcomes

**Ledger column.** Migration
`20260628_000000_source_user_outcome_quality.sql` adds two additive columns to
`source_user_outcome_events`:

- `quality_weight NUMERIC(4,3) NOT NULL DEFAULT 1.0` — constrained to the unit
  interval by a named `CHECK (quality_weight >= 0 AND quality_weight <= 1)`.
- `quality_label TEXT` — a human-readable classifier (`clean`, `partial_apply`,
  `transcode_warning`, `skipped_files`).

The `DEFAULT 1.0` means every pre-existing row reads back as a full-quality
success, so the reputation model is **unchanged for historical data**.

**Pure classifier.** `source-user-outcome-quality.js` turns an apply result into
a graded outcome:

- A clean apply (no warnings) → `quality_weight = 1.0`, label `clean`.
- A degraded apply → `completionRatio = appliedFileCount / totalFiles`, minus a
  `transcodePenalty` (0.2 when transcode preflight failed/was unavailable),
  floored at `MIN_DEGRADED_QUALITY_WEIGHT = 0.25` so an applied-but-imperfect
  delivery never scores below a flat-out failure (which is a separate `outcome:
  'failure'` with weight 0). Labels: `partial_apply` / `transcode_warning` /
  `skipped_files`.

**Reputation model split.** `source-user-reputation-model.js`
`computeDecayedOutcomeCounts` now splits a graded success across both buckets:

```js
const quality = resolveQualityWeight(event); // event.qualityWeight ?? 1, clamped
decayedSuccess += weight * quality;
decayedFailure += weight * (1 - quality);
```

A 0.6-quality success therefore contributes 0.6 to success mass and 0.4 to
failure mass, and the Wilson interval / failure-ratio it feeds reflect delivered
quality. An absent weight defaults to 1 → identical to the old binary math.

**Wire-through.** The graded outcome flows
`import-candidate-apply-worker.js` (calls `classifyApplyOutcomeQuality`) →
`import-candidate-service.markImportCandidateApplied` →
`source-user-trust-evidence-service.recordSourceUserOutcomeEvidence` →
`source-user-outcome-ledger-store.appendOutcomeEvent` (persists the new
columns). Every hop carries `qualityLabel = null, qualityWeight = 1` defaults, so
unchanged callers behave exactly as before.

### 2.2 Auto-ignore → settings + G6 closed loop

**Ignore store.** Migration `20260628_000001_source_user_ignore_entries.sql`
creates `source_user_ignore_entries` (id UUID PK, `username_key TEXT UNIQUE`,
`username`, `source TEXT CHECK (manual|auto_suggested)`, `reason`,
`actor_user_id`, `suggestion_signals JSONB`, `last_auto_evaluated_at`,
timestamps). `source-user-ignore-store.js` provides atomic, idempotent
`upsertIgnoreEntry` (`INSERT … ON CONFLICT (username_key) DO UPDATE`),
`listIgnoredUsernames`, `getIgnoreEntry`, `touchAutoEvaluation`, and
`removeIgnoreEntry`.

**Pure policy.** `source-user-auto-ignore-policy.js`
`evaluateAutoIgnoreApplication` gates an automated apply in strict order:

1. `auto_apply_disabled` — `settings.autoIgnoreEnabled !== true` (default OFF).
2. `not_suggested` — the reputation model did not raise a confident suggestion.
3. For an existing entry: `cooldown` if `lastAutoEvaluatedAt` is within
   `autoIgnoreCooldownHours` (default 24), else `already_ignored`.
4. Otherwise → `apply: true`, `source: 'auto_suggested'`.

**Service.** `source-user-ignore-service.js` orchestrates the store, settings,
and audit log:

- `applyIgnoreSuggestion(...)` — manual one-click apply; upserts `source:
  'manual'` and audits `source_user_ignored`.
- `removeIgnoredUser(...)` — deletes and audits `source_user_unignored` only
  when a row was actually removed.
- `evaluateAutoIgnoreForUser(...)` — loads `acquisition` settings, runs the pure
  policy, and on `apply` upserts `source: 'auto_suggested'` + audits
  `source_user_auto_ignored` with `actorType: 'system'`; on `already_ignored`
  refreshes the cool-down clock via `touchAutoEvaluation`. The whole method is
  try/catch-wrapped and returns `{ applied, skipReason }` — it **never throws**
  into the hot path.
- `listIgnoredUsernamesForFilter()` — best-effort feed for G6; returns `[]` on
  any error.

**Settings.** `settings-validator.js` gains an `acquisition` namespace:
`autoIgnoreEnabled` (boolean, default `false`) and `autoIgnoreCooldownHours`
(integer, min 0 / max 8760, default 24).

**Closed loop.** Two ends are wired:

- *Learn → act:* `source-user-trust-evidence-service.js`, after replacing the
  trust snapshot, fires a best-effort hook that rebuilds the recency-weighted
  reputation and, if a confident ignore is suggested, calls the injected
  `onAutoIgnoreEvaluationFn` — wired in `activity-module.js` to
  `sourceUserIgnoreService.evaluateAutoIgnoreForUser`.
- *Act → filter:* `app.js` passes
  `sourceUserIgnoreService.listIgnoredUsernamesForFilter` as
  `listIgnoredUsernamesFn` into the import-candidate module;
  `import-candidate-service.ingestSlskdSearchResponses` resolves the live ignore
  list and hands it to `normalizeSlskdResponsesToImportCandidates` → G6's
  `candidate-source-filter`. Accepted suggestions now actually suppress future
  candidates from that peer.

---

## 3. Security

- **Opt-in, default-off automation.** Auto-apply is `false` until an operator
  explicitly enables it; the system never auto-blocks a peer out of the box.
- **Full audit trail.** Every ignore/unignore — manual or automated — writes an
  audit event (`source_user_ignored` / `source_user_unignored` /
  `source_user_auto_ignored`), with system actions tagged `actorType: 'system'`.
- **Hysteresis.** The cool-down window prevents an automated flap loop from
  hammering the ignore list or the audit log.
- **Parameterized SQL.** All store queries are fully parameterized; usernames are
  normalized to a `username_key` to prevent case/whitespace-based duplication.
- **Hot-path isolation.** The evidence hook and the G6 filter feed are
  best-effort and fully error-swallowing — a store/DB fault degrades to "no
  enrichment / empty ignore list", never a failed download or apply.
- **Bounded inputs.** `quality_weight` is DB-constrained to `[0,1]`;
  `autoIgnoreCooldownHours` is bounded `[0, 8760]`.

---

## 4. Files changed

**Migrations**

- `src/server/migrations/20260628_000000_source_user_outcome_quality.sql` (new)
- `src/server/migrations/20260628_000001_source_user_ignore_entries.sql` (new)

**Quality-weighted outcomes**

- `src/server/activity/source-user-outcome-quality.js` (new, pure)
- `src/server/activity/source-user-outcome-ledger-store.js` (quality columns)
- `src/server/activity/source-user-reputation-model.js` (decay split)
- `src/server/activity/source-user-trust-evidence-service.js` (passthrough)
- `src/server/import-candidates/import-candidate-service.js` (passthrough)
- `src/server/import-candidates/import-candidate-apply-worker.js` (classify)

**Auto-ignore closed loop**

- `src/server/activity/source-user-ignore-store.js` (new)
- `src/server/activity/source-user-auto-ignore-policy.js` (new, pure)
- `src/server/activity/source-user-ignore-service.js` (new)
- `src/server/validators/settings-validator.js` (`acquisition` namespace)
- `src/server/activity/source-user-trust-evidence-service.js` (evidence hook)
- `src/server/activity/activity-module.js` (wiring + route deps)
- `src/server/import-candidates/import-candidate-service.js` (ignore feed)
- `src/server/import-candidates/import-candidate-module.js` (ignore feed)
- `src/server/app.js` (wire `listIgnoredUsernamesFn`)

**Tests**

- `test/server/source-user-outcome-quality.test.js` (new)
- `test/server/source-user-ignore-store.test.js` (new)
- `test/server/source-user-auto-ignore-policy.test.js` (new)
- `test/server/source-user-ignore-service.test.js` (new)
- `test/server/source-user-reputation-model.test.js` (quality split tests)
- `test/server/source-user-outcome-ledger-store.test.js` (quality param assertions)
- `test/server/import-candidate-service.test.js` (evidence-arg expectations)

---

## 5. Validation

- Targeted `node --test` across all new and changed suites — green.
- `npx eslint` on changed sources — clean.
- `node scripts/check-copyright.js` — all new files carry the GPL header.
- `node scripts/check-migration-filenames.js`,
  `node scripts/check-migration-id-policy.js` — both migrations conform.
- Schema snapshot regenerated (DB-free) and verified with
  `node scripts/check-schema-snapshot.js`.
- Full `npm test` — lint + test hygiene + node tests + integration.

---

## 6. Pros / cons & final recommendation stack

### Quality-weighted outcomes

| Option | Pros | Cons |
| --- | --- | --- |
| **Additive `quality_weight` column + pure classifier + decay split (chosen)** | Backward compatible (default 1.0); append-only, no race; reputation reflects fidelity; classifier is pure/testable | One more column; classifier heuristics need tuning over time |
| New discrete `outcome` enum values (`partial`, `fake`, …) | Explicit vocabulary | Breaks the binary success/failure consumers; coarse; no proportional weighting |
| Separate `quality_score` side-table | Fully decoupled | Extra join on every read; over-engineered for one scalar |

### Auto-ignore closed loop

| Option | Pros | Cons |
| --- | --- | --- |
| **Dedicated `source_user_ignore_entries` table + pure policy + opt-in service (chosen)** | Atomic `ON CONFLICT`; no snapshot/backup coupling; auditable; cool-down prevents flapping; default-off | New table + service surface |
| Field on the trust-snapshot blob | Reuses an existing table | Re-introduces lost-update race; entangles backup/restore; whole-blob rewrite |
| In-memory ignore set | Zero schema | Not durable; lost on restart; not auditable |

**Final recommendation stack (implemented):**

- **Quality:** additive, DB-constrained `quality_weight ∈ [0,1]` + `quality_label`
  on the append-only ledger; a **pure** `classifyApplyOutcomeQuality`; reputation
  decay **splits** graded successes across success/failure mass. Default 1.0
  preserves all historical behaviour.
- **Auto-ignore:** a **dedicated, atomic, auditable** ignore table; a **pure**
  gating policy (`disabled → not-suggested → cooldown → already-ignored →
  apply`); an **opt-in, default-OFF** `acquisition.autoIgnoreEnabled` with a
  bounded `autoIgnoreCooldownHours`; a **best-effort, error-swallowing** evidence
  hook and G6 filter feed that never block the hot path.

---

## 7. Three more high-value design areas

1. **Operator-facing trust & ignore UI.** Build the authenticated source-users
   surface: a reputation table (Wilson lower bound, decayed failure ratio,
   quality mix), the auto-ignore *suggestion* with one-click apply, an
   enable/disable toggle for auto-apply + cool-down, and a reviewable ignore
   list with un-ignore. The backend route dependencies
   (`applyIgnoreSuggestion`, `listIgnoredSourceUsers`, `removeIgnoredSourceUser`)
   are already exposed and waiting for a UI.
2. **Quality signal sources beyond the apply result.** Feed the `quality_weight`
   from richer evidence — post-apply library scan deltas (actual bitrate/format
   vs. requested), tag-completeness checks, and transcode-detection heuristics —
   so fake/transcoded FLAC is graded down at the source, and surface a
   per-peer "delivered quality" trend.
3. **Ledger & ignore lifecycle: retention, backup, export.** Decide and document
   whether `source_user_outcome_events` and `source_user_ignore_entries`
   participate in backup/restore scopes, add a scheduled `pruneOutcomeEvents`
   maintenance task tied to `maxAgeDays`, and define export/redaction semantics so
   the evidence log and ignore list have a first-class, governed lifecycle.
