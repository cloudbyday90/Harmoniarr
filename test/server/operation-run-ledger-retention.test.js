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
import {
  countPrunableOperationRuns,
  createOperationRunStore,
  pruneOperationRunsLedger,
} from '../../src/server/operation-run-store.js';

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ params, text });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('markRunCompleted no longer prunes the ledger inline', async () => {
  const pool = createFakePool();
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  await store.markRunCompleted({ runId: 'run-1', summary: { done: true } });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /UPDATE operation_runs/);
  assert.ok(!pool.calls.some((call) => /DELETE FROM operation_runs/.test(call.text)));
});

test('markRunCancelled no longer prunes the ledger inline', async () => {
  const pool = createFakePool();
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  await store.markRunCancelled({ runId: 'run-1' });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /status = 'cancelled'/);
  assert.ok(!pool.calls.some((call) => /DELETE FROM operation_runs/.test(call.text)));
});

test('markRunFailed (terminal) no longer prunes the ledger inline', async () => {
  const pool = createFakePool((text) => {
    if (/SELECT/.test(text)) {
      return { rows: [{ id: 'run-1', attempt_count: 1, max_attempts: 1, status: 'running' }] };
    }
    return { rows: [], rowCount: 0 };
  });
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  await store.markRunFailed({ runId: 'run-1', errorMessage: 'boom' });

  assert.ok(!pool.calls.some((call) => /DELETE FROM operation_runs/.test(call.text)));
});

test('pruneOperationRunsLedger deletes terminal runs older than the cutoff with a per-type floor', async () => {
  const pool = createFakePool(() => ({ rows: [], rowCount: 4 }));

  const result = await pruneOperationRunsLedger({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 50,
  });

  assert.equal(result.prunedCount, 4);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /DELETE FROM operation_runs/);
  assert.match(pool.calls[0].text, /PARTITION BY operation_type/);
  assert.equal(pool.calls[0].params[0], '2026-01-01T00:00:00.000Z');
  assert.equal(pool.calls[0].params[1], 50);
});

test('pruneOperationRunsLedger is a no-op without a cutoff and clamps the retain floor', async () => {
  const pool = createFakePool(() => ({ rows: [], rowCount: 9 }));

  const noop = await pruneOperationRunsLedger({ getPoolFn: pool.getPoolFn });
  assert.equal(noop.prunedCount, 0);
  assert.equal(pool.calls.length, 0);

  await pruneOperationRunsLedger({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 0,
  });
  assert.equal(pool.calls[0].params[1], 1);
});

test('countPrunableOperationRuns counts without deleting', async () => {
  const pool = createFakePool(() => ({ rows: [{ prunable_count: 7 }] }));

  const result = await countPrunableOperationRuns({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 25,
  });

  assert.equal(result.prunableCount, 7);
  assert.match(pool.calls[0].text, /SELECT COUNT\(\*\)/);
  assert.ok(!/DELETE/.test(pool.calls[0].text));
});
