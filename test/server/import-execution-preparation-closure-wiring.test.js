/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';

test('actual module delegates an observed preparing epoch to its closure owner before confirmation', async () => {
  const epoch = { phase: 'preparing', epochId: 'observed-private-epoch' }; const closed = [];
  const module = createImportCandidateModule({ slskdService: {}, importExecutionPreparationClosureService: {
    closeAbandonedPreparation: async (input) => { closed.push(input); return { closed: true }; },
  }, importExecutionHandoffService: { adoptDownloadHandoff: async () => {},
    confirmDownloadHandoff: async () => { assert.fail('Closed preparation must not enter confirmation'); } },
  importCandidateExecutionSummaryService: { buildImportCandidateExecutionSummary: async () => ({ currentRun: {
    id: 'run', items: [{ importCandidateId: 'candidate', planningSnapshot: { execution: { handoff: { preProviderEpoch: epoch } } } }],
  } }) } });
  const result = await module.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionState();
  assert.deepEqual(closed, [{ operationRunId: 'run', importCandidateId: 'candidate', expectedEpoch: epoch }]);
  assert.equal(result.summary.preparationsClosed, 1);
  assert.equal(result.summary.transitioned, 0); assert.equal(result.summary.recovered, 0);
  assert.equal(Object.hasOwn(module.routeDependencies, 'closeAbandonedPreparation'), false);
});

test('a denied closure preserves normal unknown confirmation and emits no closure count', async () => {
  const calls = [];
  const service = createImportCandidateExecutionReconciliationService({
    closeAbandonedPreparation: async () => { calls.push('closure'); return { closed: false, reasonCode: 'preparation_active' }; },
    confirmDownloadHandoff: async () => { calls.push('confirmation'); return { confirmed: false, disposition: 'unknown' }; },
  });
  const result = await service.reconcileImportCandidateExecutionSummary({ executionSummary: { currentRun: { id: 'run', items: [{
    importCandidateId: 'candidate', itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: { handoff: { preProviderEpoch: { phase: 'preparing' } } } },
  }] } } });
  assert.deepEqual(calls, ['closure', 'confirmation']);
  assert.equal(Object.hasOwn(result.summary, 'preparationsClosed'), false);
  assert.equal(result.summary.transitioned, 0);
});

test('raw operation retry refuses even a malformed closure fence before scheduling', async (t) => {
  const scheduleRetry = t.mock.fn(async () => { assert.fail('A closure fence must not be retried'); });
  for (const downloadPreparationClosure of [null, {}, { version: 1 }]) {
    const service = createOperationRunControlService({ getPoolFn: () => ({ query: async () => ({ rows: [{
      id: 'run', operation_type: 'import_candidate_execution_planning', status: 'cancelled', summary: { downloadPreparationClosure },
    }] }) }), operationQueueStore: { scheduleRetry } });
    await assert.rejects(service.requestOperationRunRetry({ runId: 'run' }), { code: 'operation_run_not_retryable' });
  }
  assert.equal(scheduleRetry.mock.callCount(), 0);
});
