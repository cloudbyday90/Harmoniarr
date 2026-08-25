import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';

function buildLinkedRow({
  importCandidateId = 'candidate-1',
  operationRunId = 'run-1',
  providerTransferId = 'transfer-1',
  sourceUsername = 'source-user',
} = {}) {
  return {
    id: 'link-1',
    import_candidate_id: importCandidateId,
    import_execution_run_item_id: 'item-1',
    linked_at: new Date('2026-08-25T19:20:00.000Z'),
    operation_run_id: operationRunId,
    provider: 'slskd',
    provider_transfer_id: providerTransferId,
    source_username: sourceUsername,
  };
}

test('recordConfirmedTransfers persists only distinct, provider-confirmed transfer identities', async (t) => {
  let observedParameters = null;
  let observedSql = '';
  const pool = {
    query: t.mock.fn(async (sql, parameters) => {
      observedSql = sql;
      observedParameters = parameters;
      return { rows: [buildLinkedRow()] };
    }),
  };
  const store = createImportExecutionTransferLinkStore({ getPoolFn: () => pool });

  const links = await store.recordConfirmedTransfers({
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    transfers: [{
      id: 'transfer-1',
      username: 'source-user',
    }, {
      id: 'transfer-1',
      sourceUser: 'source-user',
    }, {
      id: null,
      username: 'ignored-user',
    }],
  });

  assert.equal(pool.query.mock.callCount(), 1);
  assert.match(observedSql, /INSERT INTO import_execution_transfer_links/);
  assert.match(observedSql, /ON CONFLICT \(provider, source_username, provider_transfer_id\) DO NOTHING/);
  assert.match(observedSql, /import_execution_run_items/);
  assert.deepEqual(observedParameters.slice(0, 2), ['run-1', 'candidate-1']);
  assert.deepEqual(JSON.parse(observedParameters[2]), [{
    provider: 'slskd',
    provider_transfer_id: 'transfer-1',
    source_username: 'source-user',
  }]);
  assert.deepEqual(links, [{
    id: 'link-1',
    importCandidateId: 'candidate-1',
    importExecutionRunItemId: 'item-1',
    linkedAt: '2026-08-25T19:20:00.000Z',
    operationRunId: 'run-1',
    provider: 'slskd',
    providerTransferId: 'transfer-1',
    sourceUsername: 'source-user',
  }]);
});

test('recordConfirmedTransfers accepts a repeated confirmed identity only when it has the same owner', async (t) => {
  const pool = {
    query: t.mock.fn(async () => ({ rows: [buildLinkedRow()] })),
  };
  const store = createImportExecutionTransferLinkStore({ getPoolFn: () => pool });

  await assert.doesNotReject(() => store.recordConfirmedTransfers({
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    transfers: [{ id: 'transfer-1', username: 'source-user' }],
  }));
});

test('recordConfirmedTransfers rejects a transfer identity owned by another execution candidate', async (t) => {
  const pool = {
    query: t.mock.fn(async () => ({
      rows: [buildLinkedRow({ importCandidateId: 'candidate-elsewhere' })],
    })),
  };
  const store = createImportExecutionTransferLinkStore({ getPoolFn: () => pool });

  await assert.rejects(
    () => store.recordConfirmedTransfers({
      importCandidateId: 'candidate-1',
      operationRunId: 'run-1',
      transfers: [{ id: 'transfer-1', username: 'source-user' }],
    }),
    (error) => error?.code === 'import_execution_transfer_link_conflict',
  );
});

test('recordConfirmedTransfers does not write when provider confirmation has no stable transfer identity', async (t) => {
  const pool = {
    query: t.mock.fn(async () => ({ rows: [] })),
  };
  const store = createImportExecutionTransferLinkStore({ getPoolFn: () => pool });

  const links = await store.recordConfirmedTransfers({
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    transfers: [{ id: '', username: 'source-user' }],
  });

  assert.deepEqual(links, []);
  assert.equal(pool.query.mock.callCount(), 0);
});
