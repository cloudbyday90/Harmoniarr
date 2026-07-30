/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createImportCandidateApplyRunStore } from '../../src/server/import-candidates/import-candidate-apply-run-store.js';

test('import candidate apply run store exposes persisted quality recovery counters', async () => {
  const getPoolFn = () => ({
    query: async () => ({
      rows: [{
        error_message: null,
        finished_at: new Date('2026-07-30T12:00:00.000Z'),
        id: 'run-quality-1',
        operation_type: 'import_candidate_apply',
        started_at: new Date('2026-07-30T11:59:00.000Z'),
        status: 'completed',
        summary: {
          qualityBlockedCount: 1,
          qualityRecoveryExhaustedCount: 1,
          qualityRecoveryRediscoveryCount: 0,
          qualityRecoveryStartedCount: 0,
        },
      }],
    }),
  });
  const store = createImportCandidateApplyRunStore({ getPoolFn });

  const run = await store.getRunById('run-quality-1');

  assert.deepEqual({
    qualityBlockedCount: run.qualityBlockedCount,
    qualityRecoveryExhaustedCount: run.qualityRecoveryExhaustedCount,
    qualityRecoveryRediscoveryCount: run.qualityRecoveryRediscoveryCount,
    qualityRecoveryStartedCount: run.qualityRecoveryStartedCount,
  }, {
    qualityBlockedCount: 1,
    qualityRecoveryExhaustedCount: 1,
    qualityRecoveryRediscoveryCount: 0,
    qualityRecoveryStartedCount: 0,
  });
});
