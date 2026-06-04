/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { recordAuditEvent } from './audit.js';
import {
  resolveLedgerRetentionPolicy,
  resolveRetentionCutoffIso,
} from './ledger-retention-policy.js';
import { loadSettings } from './settings.js';
import {
  countPrunableOperationRuns,
  pruneOperationRunsLedger,
} from './operation-run-store.js';

const LEDGER_RETENTION_AUDIT_EVENT_TYPE = 'ledger_retention_pruned';

/**
 * Control-plane ledger retention service.
 *
 * Centralizes the explicit, policy-driven disposal of control-plane ledgers so
 * that pruning is no longer coupled to normal operation completion. Honors the
 * governing principles in BACKUP_RESTORE_DESIGN.md and the OWASP Logging Cheat
 * Sheet:
 * - deletion is a deliberate, configurable policy action (age + count floor);
 * - verbose event streams (outcome events) are pruned alongside canonical run
 *   records, never coupling UI visibility to physical deletion;
 * - a material disposal is itself recorded as an audit event;
 * - the heartbeat path never throws (availability over strictness).
 *
 * All collaborators are injectable for deterministic unit testing.
 */
export function createLedgerRetentionService({
  countPrunableOperationRunsFn = countPrunableOperationRuns,
  loadSettingsFn = loadSettings,
  outcomeLedgerStore,
  pruneOperationRunsLedgerFn = pruneOperationRunsLedger,
  recordAuditEventFn = recordAuditEvent,
  resolveLedgerRetentionPolicyFn = resolveLedgerRetentionPolicy,
  resolveRetentionCutoffIsoFn = resolveRetentionCutoffIso,
} = {}) {
  if (!outcomeLedgerStore || typeof outcomeLedgerStore.pruneOutcomeEvents !== 'function') {
    throw new Error('outcomeLedgerStore with pruneOutcomeEvents is required');
  }

  async function resolvePolicyAndCutoffs(now) {
    const settings = await loadSettingsFn();
    const policy = resolveLedgerRetentionPolicyFn(settings);
    return {
      policy,
      operationRunCutoffIso: resolveRetentionCutoffIsoFn(policy.operationRuns.maxAgeDays, now),
      outcomeEventCutoffIso: resolveRetentionCutoffIsoFn(policy.outcomeEvents.maxAgeDays, now),
    };
  }

  /**
   * Computes how many rows the next retention pass would remove without
   * mutating any ledger. Safe to expose for operator observability/export.
   */
  async function previewLedgerRetention({ now = new Date() } = {}) {
    const { policy, operationRunCutoffIso, outcomeEventCutoffIso } = await resolvePolicyAndCutoffs(now);

    const [operationRunResult, outcomeEventResult] = await Promise.all([
      countPrunableOperationRunsFn({
        olderThanIso: operationRunCutoffIso,
        retainCountPerType: policy.operationRuns.retainCountPerType,
      }),
      typeof outcomeLedgerStore.countExpiredOutcomeEvents === 'function'
        ? outcomeLedgerStore.countExpiredOutcomeEvents({ olderThan: outcomeEventCutoffIso })
        : Promise.resolve({ prunableCount: 0 }),
    ]);

    return {
      dryRun: true,
      policy,
      operationRuns: {
        cutoff: operationRunCutoffIso,
        prunableCount: operationRunResult?.prunableCount ?? 0,
        retainCountPerType: policy.operationRuns.retainCountPerType,
      },
      outcomeEvents: {
        cutoff: outcomeEventCutoffIso,
        prunableCount: outcomeEventResult?.prunableCount ?? 0,
      },
    };
  }

  /**
   * Applies the resolved retention policy across the control-plane ledgers.
   * Records a single audit event only when the pass materially deleted rows.
   * Never throws: on failure it returns a structured error summary so the
   * scheduled heartbeat keeps the process healthy.
   */
  async function applyLedgerRetention({ actorUserId = null, trigger = 'scheduled', now = new Date() } = {}) {
    try {
      const { policy, operationRunCutoffIso, outcomeEventCutoffIso } = await resolvePolicyAndCutoffs(now);

      const operationRunResult = await pruneOperationRunsLedgerFn({
        olderThanIso: operationRunCutoffIso,
        retainCountPerType: policy.operationRuns.retainCountPerType,
      });
      const outcomeEventResult = await outcomeLedgerStore.pruneOutcomeEvents({
        olderThan: outcomeEventCutoffIso,
      });

      const operationRunsPruned = operationRunResult?.prunedCount ?? 0;
      const outcomeEventsPruned = outcomeEventResult?.prunedCount ?? 0;
      const totalPruned = operationRunsPruned + outcomeEventsPruned;

      const summary = {
        dryRun: false,
        operationRuns: {
          cutoff: operationRunCutoffIso,
          prunedCount: operationRunsPruned,
          retainCountPerType: policy.operationRuns.retainCountPerType,
        },
        outcomeEvents: {
          cutoff: outcomeEventCutoffIso,
          prunedCount: outcomeEventsPruned,
        },
        policy,
        totalPruned,
        trigger,
      };

      if (totalPruned > 0) {
        await recordAuditEventFn({
          actorUserId,
          actorType: actorUserId ? 'user' : 'system',
          eventType: LEDGER_RETENTION_AUDIT_EVENT_TYPE,
          summary: `Ledger retention removed ${totalPruned} record(s)`,
          details: {
            operationRunsPruned,
            outcomeEventsPruned,
            operationRunCutoff: operationRunCutoffIso,
            outcomeEventCutoff: outcomeEventCutoffIso,
            trigger,
          },
        });
      }

      return summary;
    } catch (error) {
      return {
        dryRun: false,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        totalPruned: 0,
        trigger,
      };
    }
  }

  return {
    applyLedgerRetention,
    previewLedgerRetention,
  };
}
