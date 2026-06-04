# Ledger & Ignore-List Lifecycle Design

Status: Implemented (Phase 10)
Scope: Control-plane operation-run ledger, source-user outcome ledger, source-user
ignore list. Backend-only, ESM JavaScript, PostgreSQL.

## 1. Problem statement

Two long-lived control-plane data stores grew without a deliberate, auditable
retention policy, and a third (the operator ignore list) lacked a machine-readable
export path:

1. **Operation-run ledger (`operation_runs`)** was pruned **inline** from the
   completion path. `operation-run-store.js` called `pruneOldRuns()` from
   `markRunCompleted`, `markRunFailed`, and `markRunCancelled`, hardcoded to retain
   20 rows per operation type. This coupled physical deletion of canonical run
   evidence to normal operation completion and produced no audit trail.
2. **Source-user outcome ledger (`source_user_outcome_events`)** is append-only and
   shipped with an implemented but **unwired** `pruneOutcomeEvents({ olderThan })`.
   Nothing ever invoked it, so the table could grow without bound.
3. **Source-user ignore list (`source_user_ignore_entries`)** had no machine-readable,
   audited export capability for backup/portability.

## 2. Research

Tooling note: the Tavily MCP remained unavailable ("Invalid API key") for this phase.
Research was conducted via the GitHub MCP against `OWASP/CheatSheetSeries` and
corroborated against this repository's own governing design docs.

Sources and the principles drawn from them:

- **OWASP Logging Cheat Sheet — Disposal.** Log/event data "must not be destroyed
  before the duration of the required data retention period, and must not be kept
  beyond this time." → Retention must be a deliberate, configurable policy bounded by
  a **minimum-retention floor** and a **ceiling**, not silent per-event deletion.
- **OWASP Logging Cheat Sheet — Availability.** An attacker (or a runaway producer)
  can "flood log files in order to exhaust disk space." → Bounding append-only ledgers
  is an **availability / anti-DoS security control**, not mere hygiene. The unwired
  outcome-ledger prune was the concrete gap.
- **OWASP Logging Vocabulary — audit trails / `sensitive_delete`.** "Data addition,
  modification and deletion, data exports" should be logged. → Retention that
  *materially* deletes records, and *export* operations, must themselves be audited.
- **Repo `BACKUP_RESTORE_DESIGN.md` — Control-Plane Retention Matrix.** "Retention
  cleanup should delete old event rows only as an explicit policy action, not as part
  of normal operation completion"; "delete oldest … records first"; "prefer pruning
  verbose event streams before pruning canonical run records or audit evidence";
  "retention cleanup itself should be auditable when it affects control-plane records
  materially."
- **Repo `SOURCE_USER_TRUST_LEDGER_DESIGN.md`.** Already anticipated a "scheduled
  `pruneOutcomeEvents` maintenance task tied to `maxAgeDays`" — the architecture was
  designed for exactly this wiring; it was simply never connected.

## 3. Findings

- The inline `pruneOldRuns()` coupling directly violates the documented
  "explicit policy action, not normal completion" principle and is non-auditable.
- The outcome ledger's prune was dead code → unbounded growth / availability risk.
- The ignore list is **permanent operator configuration** and must **not** be subject
  to retention pruning; it only needed an audited export view.

## 4. Design

### 4.1 Pure policy resolver — `src/server/ledger-retention-policy.js`

`resolveLedgerRetentionPolicy(settings)` reads the `retention` settings namespace and
returns a clamped policy:

| Field | Default | Floor (min) | Ceiling (max) | Meaning |
|---|---|---|---|---|
| `operationRuns.maxAgeDays` | 90 | 7 | 3650 | Age ceiling for terminal run disposal |
| `operationRuns.retainCountPerType` | 50 | 10 | 1000 | Per-type minimum-retention floor |
| `outcomeEvents.maxAgeDays` | 180 | 30 | 3650 | Age ceiling for outcome-event disposal |

Clamping is applied defensively even if settings validation is bypassed.
`resolveRetentionCutoffIso(maxAgeDays, now)` converts a window into an absolute ISO
cutoff. The module is pure and fully unit-tested.

### 4.2 Retention service — `src/server/ledger-retention-service.js`

`createLedgerRetentionService({ outcomeLedgerStore, ...injectables })` exposes:

- `applyLedgerRetention({ actorUserId, trigger, now })` — resolves policy + cutoffs,
  prunes `operation_runs` (age **and** per-type count floor, oldest first) and
  `source_user_outcome_events` (age), records **one** `ledger_retention_pruned` audit
  event **only when rows were materially removed**, returns a structured summary, and
  **never throws** (returns `{ ok: false, error }` on failure so the heartbeat stays
  healthy). Actor is attributed `user` when an `actorUserId` is supplied, else `system`.
- `previewLedgerRetention({ now })` — dry-run that counts prunable rows without
  mutating or auditing. Basis for operator observability/export.

### 4.3 Decoupled store — `src/server/operation-run-store.js`

- Removed the three inline `await pruneOldRuns()` calls from `markRunCompleted`,
  `markRunFailed`, and `markRunCancelled`.
- Kept the factory `pruneOldRuns` method exported (still invoked explicitly by
  `library-discovery-worker.js` — unchanged contract).
- Added module-level `pruneOperationRunsLedger({ olderThanIso, retainCountPerType })`
  (global, cross-operation-type, age + per-type floor via a `ROW_NUMBER()` window) and
  `countPrunableOperationRuns(...)` for dry-run previews.

### 4.4 Outcome-ledger store — `src/server/activity/source-user-outcome-ledger-store.js`

Added `countExpiredOutcomeEvents({ olderThan })` (preview) alongside the now-wired
`pruneOutcomeEvents`.

### 4.5 Scheduled, deliberate pass — `src/server/ledger-retention-heartbeat.js`

`createLedgerRetentionHeartbeat` builds an interval runner (default 24h) on the shared
`createIntervalHeartbeatRunner`. It pauses while a maintenance lock is active (via the
maintenance-lock heartbeat pause service) and never throws. This heartbeat **is** the
"explicit policy action" that replaces inline completion-path pruning. It is registered
with the startup supervisor in `startup-runtime.js`, alongside the existing
`idempotencyRecordCleanupHeartbeat` and `pushNotificationHistoryCleanupHeartbeat`.

### 4.6 Settings — `src/server/validators/settings-validator.js`

New `retention` namespace with `operationRunMaxAgeDays`, `operationRunRetainCountPerType`,
and `outcomeEventMaxAgeDays`, each normalized with the floor/ceiling above. Flows
automatically into `getDefaultSettings()` and `loadSettings()`.

### 4.7 Ignore-list export — `src/server/activity/source-user-ignore-service.js`

Added `exportIgnoredSourceUsers({ actorUserId })` returning a machine-readable snapshot
(`{ format: 'harmoniarr.source-user-ignore-list.v1', exportedAt, total, entries }`) and
recording a `source_user_ignore_list_exported` audit event. The ignore list itself
remains permanent (no retention pruning).

## 5. Security

- **Availability / anti-DoS:** both growth-prone ledgers are now bounded by a scheduled
  policy pass; the previously-dead outcome-ledger prune is wired.
- **Evidence preservation:** a documented minimum-retention floor (clamped defensively)
  guarantees terminal runs and outcome events survive long enough for incident review.
- **Oldest-first, verbose-first:** deletion targets the oldest terminal records and
  prunes verbose event streams alongside canonical run records, never coupling UI
  visibility windows to physical deletion.
- **Auditable disposal & export:** material retention passes and ignore-list exports
  each emit an audit event (`ledger_retention_pruned`, `source_user_ignore_list_exported`).
- **Fail-safe:** the heartbeat path and the ignore service degrade gracefully and never
  throw on the hot path.

## 6. Files changed

New:
- `src/server/ledger-retention-policy.js`
- `src/server/ledger-retention-service.js`
- `src/server/ledger-retention-heartbeat.js`
- `test/server/ledger-retention-policy.test.js`
- `test/server/ledger-retention-service.test.js`
- `test/server/operation-run-ledger-retention.test.js`

Modified:
- `src/server/operation-run-store.js` (decoupled inline pruning; global prune/count exports)
- `src/server/activity/source-user-outcome-ledger-store.js` (count helper)
- `src/server/activity/source-user-ignore-service.js` (audited export)
- `src/server/validators/settings-validator.js` (`retention` namespace)
- `src/server/app.js` (return `activityModule`)
- `src/server/startup-runtime.js` (service + heartbeat wiring/registration)
- `test/server/source-user-ignore-service.test.js` (export test)

No schema migration: the change is logic-only, so the schema snapshot is unaffected.

## 7. Validation

- Targeted: `node --test test/server/ledger-retention-policy.test.js
  test/server/ledger-retention-service.test.js
  test/server/operation-run-ledger-retention.test.js
  test/server/source-user-ignore-service.test.js` — 26 passing.
- Full suite: `npm test` (ESLint + test hygiene + node + integration).
- Copyright headers: `node scripts/check-copyright.js`.

## 8. Pros / cons & final recommendation stack

Options considered:

| Option | Pros | Cons |
|---|---|---|
| A. Operator-triggered `ledger_retention` operation (mirror `artwork_cleanup`) | Cancellable; visible in ops UI | Heavy surface; growth unbounded until an operator acts; over-engineered for a daily sweep |
| B. Keep inline prune routed through a policy service | Smallest change | Still couples deletion to normal completion (violates the governing principle); non-auditable on the hot path |
| **C. Scheduled retention heartbeat + pure policy + auditable service; decouple the store (chosen)** | Idiomatic (matches existing cleanup heartbeats); deliberate, configurable, auditable; bounds growth automatically; fully unit-testable | One new supervised heartbeat; retention is daily (eventually consistent), not instant |

**Final recommendation (implemented): Option C.** Pure clamped policy resolver →
auditable, fail-safe cross-ledger retention service → scheduled maintenance-lock-aware
heartbeat → store decoupled from completion-path pruning → `retention` settings namespace
→ audited, machine-readable ignore-list export. No schema migration. Security posture:
bounded ledgers (availability), enforced retention floor (evidence), oldest-/verbose-first
deletion, auditable disposal and export.

## 9. Three high-value future areas

1. **Operator-facing retention & export surface.** Promote `previewLedgerRetention`,
   `applyLedgerRetention({ trigger: 'manual' })`, and `exportIgnoredSourceUsers` into
   rate-limited, CSRF-protected routes plus a small settings/observability panel — the
   operator-triggered `ledger_retention` operation (Option A) layered on top of the
   engine shipped here. (Carried.)
2. **Shared loading/skeleton convention (client).** A reusable skeleton/loading
   affordance to match the unified toast/empty-state conventions from Phase 9. (Carried.)
3. **Unified confirm/destructive-action dialog (client).** A single accessible
   confirmation primitive for destructive actions (unignore, manual retention pass,
   delete) with consistent focus-trap and keyboard semantics. (Carried.)
