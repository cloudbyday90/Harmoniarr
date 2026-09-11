import assert from 'node:assert/strict';
import test from 'node:test';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createLibraryExternalRequestCollectionIntakeStore } from '../../src/server/library/library-external-request-collection-intake-store.js';

test('collection cancellation guard shares the caller transaction and serializes cancellation updates', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [{ cancel_requested_at: new Date() }] }));
  const store = createLibraryExternalRequestCollectionIntakeStore({ getPoolFn: () => assert.fail('A held transaction must not borrow another pool client') });
  assert.equal(await store.isCancellationRequested({ runId: 'run', queryable: { query } }), true);
  assert.match(query.mock.calls[0].arguments[0], /FOR SHARE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['run']);
});

test('collection initialization checks both actual persisted preparation operation types', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [{ id: 'other-run' }], rowCount: 1 }));
  const store = createLibraryExternalRequestCollectionIntakeStore({ getPoolFn: () => assert.fail('Use the initialization transaction') });
  assert.equal(await store.hasOtherPreparation({ mediaRequestId: 'request', operationRunId: 'current-run', queryable: { query } }), true);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['request', 'current-run', [
    operationRunRegistry.libraryExternalIntakePlanning.operationType,
    operationRunRegistry.libraryExternalIntakeExecution.operationType,
  ]]);
});
