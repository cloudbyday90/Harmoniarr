/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorTrackReceiptStore } from '../../src/server/metadata/operator-track-receipt-store.js';
import { createOperatorTrackAcquisitionStore } from '../../src/server/metadata/operator-track-acquisition-store.js';

test('receipt lookup preserves the borrowed transaction and historical DTO without mutating its receipt', async () => {
  const receipt = { version: 1, ownerId: 'owner', scope: { metadataReleaseId: 'release' } };
  let received;
  const queryable = { query: async (_sql, params) => { received = params; return { rows: [{ import_candidate_id: 'candidate', receipt }] }; } };
  const store = createOperatorTrackReceiptStore({ getPoolFn: () => { throw Error('Unexpected global pool'); } });
  assert.deepEqual(await store.listFulfillment({ ownerId: 'owner', metadataReleaseIds: ['release'], queryable }),
    [{ ...receipt, importCandidateId: 'candidate' }]);
  assert.deepEqual(received, ['owner', ['release']]);
  assert.equal(Object.hasOwn(receipt, 'importCandidateId'), false);
});

test('an empty release set performs no database read', async () => {
  const store = createOperatorTrackReceiptStore({ getPoolFn: () => { throw Error('Unexpected database read'); } });
  assert.deepEqual(await store.listFulfillment({ ownerId: 'owner', metadataReleaseIds: [] }), []);
});

test('acquisition delegates receipt selection with the original owning queryable', async () => {
  const input = { ownerId: 'owner', metadataReleaseIds: ['release'], queryable: {} };
  const store = createOperatorTrackAcquisitionStore({ receiptStore: { listFulfillment: async value => {
    assert.deepEqual(value, input); assert.equal(value.queryable, input.queryable); return ['historical'];
  } } });
  assert.deepEqual(await store.listFulfillment(input), ['historical']);
});
