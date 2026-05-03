import assert from 'node:assert/strict';
import test from 'node:test';
import { createControlPlaneIdempotencyStore } from '../../src/server/recovery/control-plane-idempotency-store.js';

function createQueryable() {
  const records = [];

  return {
    async query(sql, params = []) {
      if (/SELECT id, operation_scope, actor_user_id, idempotency_key, request_hash, status_code, response_json, created_at, expires_at\s+FROM\s+control_plane_idempotency_records/i.test(sql)) {
        const [operationScope, actorUserId, idempotencyKey] = params;
        const match = records.find((record) => (
          record.operation_scope === operationScope
          && record.actor_user_id === actorUserId
          && record.idempotency_key === idempotencyKey
        ));

        return {
          rows: match ? [match] : [],
        };
      }

      if (/INSERT INTO control_plane_idempotency_records/i.test(sql)) {
        const [operationScope, actorUserId, idempotencyKey, requestHash, statusCode, responseJson, expiresAt] = params;
        const row = {
          id: `id-${records.length + 1}`,
          operation_scope: operationScope,
          actor_user_id: actorUserId,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          status_code: statusCode,
          response_json: JSON.parse(responseJson),
          created_at: new Date('2026-05-02T13:00:00.000Z'),
          expires_at: expiresAt,
        };

        records.push(row);

        return {
          rows: [row],
        };
      }

      if (/DELETE FROM control_plane_idempotency_records\s+WHERE id/i.test(sql)) {
        const [id] = params;
        const index = records.findIndex((record) => record.id === id);
        if (index >= 0) {
          records.splice(index, 1);
        }

        return { rows: [] };
      }

      if (/DELETE FROM control_plane_idempotency_records\s+WHERE expires_at/i.test(sql)) {
        const [nowParam] = params;
        const nowValue = nowParam ? new Date(nowParam) : new Date();
        let deletedCount = 0;

        for (let i = records.length - 1; i >= 0; i--) {
          if (records[i].expires_at && new Date(records[i].expires_at) <= nowValue) {
            records.splice(i, 1);
            deletedCount += 1;
          }
        }

        return { rows: [], rowCount: deletedCount };
      }

      throw new Error('Unexpected query in control-plane idempotency store test double');
    },
  };
}

test('control plane idempotency store creates and reads records by scope, actor, and key', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });

  await store.createRecord({
    actorUserId: 'user-1',
    expiresAt: '2026-05-04T13:00:00.000Z',
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-1',
    response: {
      accepted: true,
    },
    statusCode: 202,
  });

  const record = await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-1',
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.create',
  });

  assert.equal(record.idempotencyKey, 'idem-1');
  assert.equal(record.operationScope, 'recovery.backups.create');
  assert.equal(record.statusCode, 202);
  assert.equal(record.response.accepted, true);
});

test('control plane idempotency store deletes records by id', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });

  const created = await store.createRecord({
    actorUserId: 'user-2',
    expiresAt: '2026-05-04T13:00:00.000Z',
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.delete',
    requestHash: 'hash-2',
    response: {
      accepted: true,
    },
    statusCode: 200,
  });

  await store.deleteRecordById({ id: created.id });

  const missing = await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-2',
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.delete',
  });

  assert.equal(missing, null);
});

test('control plane idempotency store deletes expired records and leaves unexpired records intact', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });

  await store.createRecord({
    actorUserId: 'user-3',
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'expired-key',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-expired',
    response: { accepted: true },
    statusCode: 202,
  });

  await store.createRecord({
    actorUserId: 'user-3',
    expiresAt: '2026-05-04T13:00:00.000Z',
    idempotencyKey: 'valid-key',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-valid',
    response: { accepted: true },
    statusCode: 202,
  });

  const result = await store.deleteExpiredRecords({
    now: '2026-05-03T12:00:00.000Z',
  });

  assert.equal(result.deletedCount, 1);

  const expiredRecord = await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-3',
    idempotencyKey: 'expired-key',
    operationScope: 'recovery.backups.create',
  });
  assert.equal(expiredRecord, null);

  const validRecord = await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-3',
    idempotencyKey: 'valid-key',
    operationScope: 'recovery.backups.create',
  });
  assert.equal(validRecord.idempotencyKey, 'valid-key');
});
