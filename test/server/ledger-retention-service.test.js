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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLedgerRetentionService } from '../../src/server/ledger-retention-service.js';

function buildHarness({
  outcomePruned = 0,
  runsPruned = 0,
  outcomePrunable = 0,
  runsPrunable = 0,
} = {}) {
  const auditEvents = [];
  const calls = { applyArgs: [], pruneOperationRuns: [], pruneOutcome: [] };

  const service = createLedgerRetentionService({
    loadSettingsFn: async () => ({
      retention: {
        operationRunMaxAgeDays: 90,
        operationRunRetainCountPerType: 50,
        outcomeEventMaxAgeDays: 180,
      },
    }),
    pruneOperationRunsLedgerFn: async (args) => {
      calls.pruneOperationRuns.push(args);
      return { prunedCount: runsPruned };
    },
    countPrunableOperationRunsFn: async () => ({ prunableCount: runsPrunable }),
    outcomeLedgerStore: {
      pruneOutcomeEvents: async (args) => {
        calls.pruneOutcome.push(args);
        return { prunedCount: outcomePruned };
      },
      countExpiredOutcomeEvents: async () => ({ prunableCount: outcomePrunable }),
    },
    recordAuditEventFn: async (event) => {
      auditEvents.push(event);
    },
  });

  return { auditEvents, calls, service };
}

test('createLedgerRetentionService requires an outcome ledger store', () => {
  assert.throws(() => createLedgerRetentionService({ outcomeLedgerStore: {} }), /pruneOutcomeEvents/);
});

test('applyLedgerRetention prunes both ledgers and records an audit event when material', async () => {
  const { auditEvents, calls, service } = buildHarness({ runsPruned: 3, outcomePruned: 5 });

  const summary = await service.applyLedgerRetention({ trigger: 'scheduled' });

  assert.equal(summary.totalPruned, 8);
  assert.equal(summary.operationRuns.prunedCount, 3);
  assert.equal(summary.outcomeEvents.prunedCount, 5);
  assert.equal(calls.pruneOperationRuns[0].retainCountPerType, 50);
  assert.match(calls.pruneOperationRuns[0].olderThanIso, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(calls.pruneOutcome[0].olderThan, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].eventType, 'ledger_retention_pruned');
  assert.equal(auditEvents[0].actorType, 'system');
  assert.equal(auditEvents[0].details.operationRunsPruned, 3);
  assert.equal(auditEvents[0].details.outcomeEventsPruned, 5);
});

test('applyLedgerRetention does not record an audit event when nothing was pruned', async () => {
  const { auditEvents, service } = buildHarness({ runsPruned: 0, outcomePruned: 0 });

  const summary = await service.applyLedgerRetention();

  assert.equal(summary.totalPruned, 0);
  assert.equal(auditEvents.length, 0);
});

test('applyLedgerRetention attributes a user actor when actorUserId is supplied', async () => {
  const { auditEvents, service } = buildHarness({ runsPruned: 1 });

  await service.applyLedgerRetention({ actorUserId: 'admin-1' });

  assert.equal(auditEvents[0].actorType, 'user');
  assert.equal(auditEvents[0].actorUserId, 'admin-1');
});

test('applyLedgerRetention never throws and returns a structured error summary', async () => {
  const service = createLedgerRetentionService({
    loadSettingsFn: async () => ({ retention: {} }),
    pruneOperationRunsLedgerFn: async () => {
      throw new Error('database offline');
    },
    outcomeLedgerStore: { pruneOutcomeEvents: async () => ({ prunedCount: 0 }) },
    recordAuditEventFn: async () => {},
  });

  const summary = await service.applyLedgerRetention();

  assert.equal(summary.ok, false);
  assert.equal(summary.error, 'database offline');
  assert.equal(summary.totalPruned, 0);
});

test('previewLedgerRetention reports prunable counts without mutating or auditing', async () => {
  const { auditEvents, calls, service } = buildHarness({ runsPrunable: 4, outcomePrunable: 9 });

  const preview = await service.previewLedgerRetention();

  assert.equal(preview.dryRun, true);
  assert.equal(preview.operationRuns.prunableCount, 4);
  assert.equal(preview.outcomeEvents.prunableCount, 9);
  assert.equal(calls.pruneOperationRuns.length, 0);
  assert.equal(calls.pruneOutcome.length, 0);
  assert.equal(auditEvents.length, 0);
});
