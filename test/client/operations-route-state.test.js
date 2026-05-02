import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationsRouteQuery,
  getOperationsRouteStateKey,
  normalizeOperationsRouteState,
} from '../../src/client/lib/operations-route-state.js';

test('normalizeOperationsRouteState trims selected run identifiers', () => {
  assert.deepEqual(normalizeOperationsRouteState({ runId: ' run-22 ' }), {
    runId: 'run-22',
  });
});

test('buildOperationsRouteQuery omits empty run identifiers', () => {
  assert.deepEqual(buildOperationsRouteQuery({ runId: 'run-22' }), {
    runId: 'run-22',
  });
  assert.deepEqual(buildOperationsRouteQuery({ runId: ' ' }), {});
});

test('getOperationsRouteStateKey matches equivalent normalized route states', () => {
  assert.equal(
    getOperationsRouteStateKey({ runId: ' run-22 ' }),
    getOperationsRouteStateKey({ runId: 'run-22' }),
  );
});