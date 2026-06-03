# Source-User Trust & Outcome Ledger

Status: **Implemented.** This document records the design and outcome for the
**Source-user trust & outcome ledger** — item #3 of the "three more high-value
design areas" closed out at the end of
[ACQUISITION_PIPELINE_PHASE3_DESIGN.md](ACQUISITION_PIPELINE_PHASE3_DESIGN.md).
It turns the per-uploader reputation signal from a lifetime, monotonic,
concurrency-fragile counter into a **durable, append-only, recency-weighted,
statistically-confident, and explainable** trust signal.

It delivers three tightly-scoped capabilities:

1. **An append-only outcome ledger.** Every delivery outcome (success/failure)
   for a source user is recorded as an **immutable `INSERT`** into a dedicated
   `source_user_outcome_events` table. A pure `INSERT` is inherently free of the
   read-modify-write lost-update race that the existing snapshot-blob rewrite
   suffers from — which directly hardens the Phase 3 webhook *nudge* racing the
   heartbeat reconciliation.
2. **A recency-weighted, confidence-aware reputation model.** A pure module
   collapses the ledger into **exponential time-decayed** success/failure counts
   and computes a **Wilson score interval** so reputation reflects *current*
   behaviour with *statistical confidence*, not lifetime noise.
3. **An explainable auto-ignore suggestion.** From that model, a pure evaluator
   produces an advisory, human-readable "suggested ignore" signal that closes the
   loop to Phase 3's G6 source filter — turning a manual blacklist into a learned
   trust signal **without ever auto-blocking a peer by itself**.

All three are **purely additive**. The operator-facing trust state
(`recovery_trust_snapshots`, manual overrides, blocklist) is untouched; the new
ledger and model are read as best-effort enrichments, so existing behaviour is
preserved bit-for-bit until the ledger has accumulated evidence.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories — no
assumed URLs. The **Tavily MCP was unavailable** (invalid API key, consistent
with the prior phases), so all external facts were read through the **GitHub
MCP** (`github_repo` / `search_code` / `get_file_contents`) against the upstream
projects that publish the authoritative implementations, current as of the work
date (2026).

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Wilson score interval | `sethdford/h-uman` · `scripts/blind_ab/score.py` (`wilson(k, n, z=1.96)`) — the canonical Evan Miller "How Not To Sort By Average Rating" formulation | Rank a peer by the **lower bound** of a 95% Wilson score interval, not the raw success ratio. The interval is **wide for small samples** (so a 1/1 success does not outrank a 90/100 success) and **degrades gracefully to a zero-width interval at `n = 0`**. We reproduce the exact formula (`d = 1 + z²/n`; centre `= (p + z²/2n)/d`; half `= z·√(p(1-p)/n + z²/4n²)/d`) and extend it to accept **fractional decay-weighted pseudo-counts**. |
| Atomic counter without lost updates | `lipas-liikuntapaikat/lipas` · `webapp/resources/sql/jobs.sql` (circuit-breaker `failure_count` / `success_count` via `INSERT … ON CONFLICT … DO UPDATE SET failure_count = circuit_breakers.failure_count + 1`) | The lost-update hazard of read-modify-write is removed by performing the increment **in SQL**. We go one step further: an **append-only `INSERT` per outcome** needs no `UPDATE` at all, so concurrent writers can never clobber each other, and the aggregate is computed at read time. |
| Time-decay / recency weighting | Exponential decay (half-life) is the standard recency model behind "hot ranking" reputation (the same decay family used by the Reddit/HN `score / (age)^gravity` and Wilson-sorted comment ranking discussed in the Evan Miller lineage above) | Weight each outcome by `0.5 ** (ageDays / halfLifeDays)` so an outcome at the half-life age counts for half a fresh one, and prune anything beyond a hard `maxAgeDays`. This makes reputation track *recent* reliability. |
| Append-only event sourcing + projection | General event-sourcing practice (immutable event log + derived read projection) corroborated by the circuit-breaker history table pattern above | Keep the **event log** as the source of truth and compute the reputation **projection** on read. The existing `recovery_trust_snapshots` blob remains the *operator* projection (overrides, blocklist); the new ledger is the *evidence* log. |

**Why the ledger is additive, not a replacement.** `recovery_trust_snapshots`
is part of the **backup/restore scope** ([BACKUP_RESTORE_DESIGN.md](BACKUP_RESTORE_DESIGN.md)).
Re-homing trust state into the ledger would entangle restore semantics and risk
data loss on rollback. Instead the ledger is a **parallel, additive evidence
store**: if it were dropped entirely, operator-facing trust (overrides, blocks,
lifetime counts) would be **unchanged** — only the recency-weighted enrichment
and auto-ignore suggestion would disappear. This mirrors the Phase 3 doctrine
that new signals *nudge* but never *own* correctness.

---

## 2. Design

### 2.1 Append-only ledger — `source_user_outcome_events` + `source-user-outcome-ledger-store.js`

- **Migration** `20260627_000000_source_user_outcome_events.sql` adds an
  append-only table keyed by `username_key` (normalized, case-insensitive) with
  the original `username`, the `outcome` (`CHECK IN ('success','failure')`), the
  originating `event_type`, an optional `reason`/`actor_user_id`, and
  `occurred_at` / `recorded_at` timestamps. Two indexes support the only two read
  shapes: `(username_key, occurred_at DESC)` for per-user lookups and
  `(occurred_at)` for pruning.
- **Store** `createSourceUserOutcomeLedgerStore` exposes three methods:
  - `appendOutcomeEvent(...)` — a **single parameterized `INSERT … RETURNING`**.
    Concurrency-safe by construction; rejects blank usernames / invalid outcomes
    **before** touching the pool.
  - `listRecentOutcomeEvents({ usernameKeys, since, limit })` — bounded
    (`LIMIT ≤ 5000`), parameterized `username_key = ANY($1)` + optional
    `occurred_at >= $2`; **short-circuits to `[]`** for an empty key set so a
    "match nobody" filter never scans the table.
  - `pruneOutcomeEvents({ olderThan })` — bounded retention `DELETE`, a no-op
    without a valid cutoff.

### 2.2 Reputation model — `source-user-reputation-model.js` (pure)

- `computeWilsonScoreInterval(successCount, totalCount, { z })` → `{ lowerBound,
  point, upperBound }`, clamped to `[0, 1]`, returning a zero interval for empty
  or invalid counts. Accepts fractional (decay-weighted) counts.
- `computeDecayedOutcomeCounts(events, { now, halfLifeDays, maxAgeDays })` →
  exponential time-decayed `decayedSuccess` / `decayedFailure` / `decayedTotal`,
  the raw `sampleSize`, and `lastOutcomeAt`. Malformed events and out-of-window
  events are ignored.
- `buildRecencyWeightedReputation({ events, now, options })` → the projection:
  decayed counts, `decayedFailureRatio`, `recencyWeightedSuccessRate`, and the
  Wilson `wilsonLowerBound` / `wilsonUpperBound` / `successRatePoint`.
- Defaults (`DEFAULT_REPUTATION_MODEL_OPTIONS`): `z = 1.96` (95%),
  `halfLifeDays = 30`, `maxAgeDays = 180`.

### 2.3 Explainable auto-ignore — `evaluateAutoIgnoreSuggestion(...)` (pure)

Suggests ignore **only** when all three hold (`DEFAULT_AUTO_IGNORE_THRESHOLDS`):

- `sampleSize ≥ 4` (enough recent evidence),
- `decayedFailureRatio ≥ 0.6` (failures dominate the *recent* evidence), and
- `wilsonUpperBound ≤ 0.45` (we are **confident** the success rate is low even at
  95% — not merely unlucky).

It returns `{ suggested, reason, signals }` with a human-readable `reason`
(e.g. *"Recent delivery evidence is failure-dominated (90% recency-weighted
failures across 10 outcomes) with a success rate that stays at or below 16% even
at 95% confidence."*). It is **advisory only**: it never mutates trust or blocks
a peer.

### 2.4 Wiring — concurrency-safe recording + read-time enrichment

- `createSourceUserTrustEvidenceService` gains two optional injected functions,
  `appendOutcomeEventFn` and `listRecentOutcomeEventsFn`.
- `recordSourceUserOutcomeEvidence(...)` now performs the **append-only ledger
  `INSERT` first** (best-effort, isolated in `try/catch`) and then the existing
  snapshot rewrite. The ledger write is durable and race-free even though the
  legacy snapshot rewrite is not — so the Phase 3 webhook-vs-heartbeat race no
  longer loses outcome evidence.
- `listSourceUserReputationIndex(...)` enriches each returned reputation row with
  `recencyWeighted` and `autoIgnoreSuggestion` by reading the ledger for exactly
  the included username keys. Ledger read failures are swallowed and the index
  falls back to the unchanged lifetime-count shape.
- `activity-module.js` constructs the ledger store and threads its
  `appendOutcomeEvent` / `listRecentOutcomeEvents` into the evidence service, and
  exposes `sourceUserOutcomeLedgerStore` on the module for future routes.

---

## 3. Security

- **Concurrency correctness as a safety property.** The append-only `INSERT`
  removes the read-modify-write lost-update window in the snapshot rewrite, so
  evidence under concurrent webhook + heartbeat load is no longer silently
  dropped — a correctness/integrity hardening, not just a perf change.
- **Parameterized SQL throughout.** Every query in the ledger store is fully
  parameterized (`$1…$n`, `= ANY($1)`); no string interpolation of usernames,
  reasons, or peer-supplied values — no SQL-injection surface.
- **Hostile peer values are constrained, never interpreted.** `username` /
  `reason` are normalized (`whitespace-collapsed`, trimmed) and stored as data
  only; `outcome` is constrained by a DB `CHECK`. Nothing peer-supplied is
  executed or interpolated, consistent with the Phase 3 stance on hostile
  Soulseek fields.
- **Bounded reads + retention.** Reads are capped (`LIMIT ≤ 5000`) and a
  `maxAgeDays` window plus `pruneOutcomeEvents` keep the table and the decay
  computation bounded, preventing unbounded growth or a slow-query DoS.
- **No auto-enforcement.** The auto-ignore signal is advisory; it cannot block a
  peer on its own, so a poisoned run of failures (e.g. an attacker spamming
  failed transfers from a spoofed username) can at most *suggest*, never enact,
  an ignore — a human or an explicit opt-in filter remains in the loop.
- **Best-effort isolation.** Ledger append/read failures are caught and never
  propagate into the outcome-recording or reputation-read paths.

---

## 4. Files changed

**New**

- `src/server/migrations/20260627_000000_source_user_outcome_events.sql` —
  append-only ledger table + indexes.
- `src/server/activity/source-user-outcome-ledger-store.js` — append-only store
  (`appendOutcomeEvent` / `listRecentOutcomeEvents` / `pruneOutcomeEvents`).
- `src/server/activity/source-user-reputation-model.js` — pure Wilson interval,
  time-decay counts, recency-weighted projection, and explainable auto-ignore
  evaluator.
- `test/server/source-user-outcome-ledger-store.test.js` — fake-pool store tests.
- `test/server/source-user-reputation-model.test.js` — model + auto-ignore tests.

**Modified**

- `src/server/activity/source-user-trust-evidence-service.js` — append-only
  ledger write in `recordSourceUserOutcomeEvidence`; recency/auto-ignore
  enrichment in `listSourceUserReputationIndex`.
- `src/server/activity/activity-module.js` — construct + wire the ledger store.
- `test/server/source-user-trust-evidence-service.test.js` — ledger append,
  failure isolation, and enrichment cases.
- `src/server/schema-snapshot.sql` — regenerated (DB-free) for the new migration.

---

## 5. Validation

- `node --test` for the three affected suites — **28/28 pass**.
- `npx eslint` on all changed sources — clean.
- `node scripts/check-copyright.js` — **834 files** pass (new GPL headers).
- `node scripts/check-migration-filenames.js`,
  `node scripts/check-migration-id-policy.js`,
  `node scripts/check-schema-snapshot.js` — all pass (**71 migrations**, snapshot
  current).
- Full `npm test` (lint + test-hygiene + node + integration) — green.

---

## 6. Pros / cons and final recommendation

### Append-only ledger (vs. SQL `ON CONFLICT` counter, vs. fixing the blob)
- **Pros:** Race-free by construction; preserves full per-outcome history for
  decay/Wilson; decouples evidence from the backup/restore-scoped blob; trivially
  prunable.
- **Cons:** One extra write per outcome and a read-time aggregation (both bounded
  and indexed); a second store to operate.
- **Rejected — atomic `ON CONFLICT` counter:** race-free but collapses history,
  so recency-weighting and Wilson confidence become impossible.
- **Rejected — serialize the blob rewrite (mutex/advisory lock):** fixes the race
  but keeps O(n) full-table rewrites and entangles backup/restore.

### Recency-weighted Wilson model
- **Pros:** Tracks *current* behaviour; statistically honest about small samples;
  pure and fully unit-tested.
- **Cons:** Two tunables (`halfLifeDays`, thresholds) that may need field tuning;
  centrally defaulted and overridable.

### Explainable auto-ignore suggestion
- **Pros:** Closes the loop to G6 with a learned, human-readable signal; advisory
  and safe by default.
- **Cons:** Not yet *enforced* or surfaced in settings (deliberate — see future
  work).

**Final stack.** Ship the **append-only `source_user_outcome_events` ledger** as
the evidence source, the **pure recency-weighted Wilson reputation model**
(half-life 30d, 95% confidence, 180d window) as the read-time projection, and the
**advisory explainable auto-ignore evaluator** (sample ≥ 4, recent failure ratio
≥ 0.6, success upper bound ≤ 0.45) feeding Phase 3's G6 filter. All three are
**purely additive and best-effort**: operator-facing trust, overrides, and
blocklist are unchanged, and the system degrades to its prior behaviour if the
ledger is empty or unavailable.

---

## 7. Three more high-value design areas

> **Update:** Items 1 and 2 below are now **implemented** — see
> [SOURCE_USER_TRUST_CLOSED_LOOP_DESIGN.md](SOURCE_USER_TRUST_CLOSED_LOOP_DESIGN.md).

1. **Auto-ignore → settings + G6 closed loop.** Surface the auto-ignore
   suggestion in the authenticated settings/source-users UI with one-click
   "apply to ignore list", an opt-in *auto-apply* policy (with an audit trail and
   a cool-down), and feed accepted suggestions directly into G6's
   `candidate-source-filter` `ignoredUsernames`, completing the learn→act loop.
2. **Quality-weighted outcomes (beyond success/failure).** Extend the ledger
   `outcome` vocabulary (or add a `quality_score`) to capture *partial* outcomes
   — fake/transcoded FLAC, wrong tags, truncated transfers — so reputation
   reflects delivered *quality*, not just completion, and the download-result
   scorer can weight peers by fidelity.
3. **Backup/restore & retention policy for the ledger.** Decide and document
   whether the outcome ledger participates in backup/restore scopes, add a
   scheduled `pruneOutcomeEvents` maintenance task tied to `maxAgeDays`, and
   define export/redaction semantics so the evidence log has a first-class
   lifecycle alongside `recovery_trust_snapshots`.
