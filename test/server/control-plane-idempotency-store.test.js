import assert from 'node:assert/strict';
import test from 'node:test';
import { createControlPlaneIdempotencyStore } from '../../src/server/recovery/control-plane-idempotency-store.js';

function createQueryable() {
  const records = [];

  function findRecord(operationScope, actorUserId, idempotencyKey) {
    return records.find((record) => (
      record.operation_scope === operationScope
      && record.actor_user_id === actorUserId
      && record.idempotency_key === idempotencyKey
    ));
  }

  return {
    async query(sql, params = []) {
      if (/SELECT id, operation_scope, actor_user_id, idempotency_key, request_hash, state, status_code, response_json, created_at, expires_at\s+FROM\s+control_plane_idempotency_records/i.test(sql)) {
        const [operationScope, actorUserId, idempotencyKey] = params;
        const match = findRecord(operationScope, actorUserId, idempotencyKey);
        return { rows: match ? [match] : [] };
      }

      if (/INSERT INTO control_plane_idempotency_records/i.test(sql)) {
        const [operationScope, actorUserId, idempotencyKey, requestHash, expiresAt] = params;
        if (findRecord(operationScope, actorUserId, idempotencyKey)) {
          return { rows: [] };
        }

        const row = {
          actor_user_id: actorUserId,
          created_at: new Date('2026-05-02T13:00:00.000Z'),
          expires_at: expiresAt,
          id: `id-${records.length + 1}`,
          idempotency_key: idempotencyKey,
          operation_scope: operationScope,
          request_hash: requestHash,
          response_json: {},
          state: 'in_progress',
          status_code: 202,
        };
        records.push(row);
        return { rows: [row] };
      }

      if (/UPDATE control_plane_idempotency_records\s+SET state = 'completed'/i.test(sql)) {
        const [id, statusCode, responseJson, expiresAt] = params;
        const row = records.find((record) => record.id === id && record.state === 'in_progress');
        if (!row) {
          return { rows: [] };
        }

        row.expires_at = expiresAt;
        row.response_json = JSON.parse(responseJson);
        row.state = 'completed';
        row.status_code = statusCode;
        return { rows: [row] };
      }

      if (/DELETE FROM control_plane_idempotency_records\s+WHERE id = \$1\s+AND expires_at IS NOT NULL/i.test(sql)) {
        const [id, now] = params;
        const index = records.findIndex((record) => (
          record.id === id
          && record.expires_at
          && new Date(record.expires_at) <= new Date(now)
        ));
        if (index < 0) {
          return { rowCount: 0, rows: [] };
        }

        const [deleted] = records.splice(index, 1);
        return { rowCount: 1, rows: [{ id: deleted.id }] };
      }

      if (/DELETE FROM control_plane_idempotency_records\s+WHERE id = \$1\s+AND state = 'in_progress'/i.test(sql)) {
        const [id] = params;
        const index = records.findIndex((record) => record.id === id && record.state === 'in_progress');
        if (index < 0) {
          return { rowCount: 0, rows: [] };
        }

        records.splice(index, 1);
        return { rowCount: 1, rows: [] };
      }

      if (/DELETE FROM control_plane_idempotency_records\s+WHERE expires_at IS NOT NULL/i.test(sql)) {
        const [nowParam] = params;
        const nowValue = nowParam ? new Date(nowParam) : new Date();
        let deletedCount = 0;

        for (let index = records.length - 1; index >= 0; index -= 1) {
          if (records[index].expires_at && new Date(records[index].expires_at) <= nowValue) {
            records.splice(index, 1);
            deletedCount += 1;
          }
        }

        return { rowCount: deletedCount, rows: [] };
      }

      throw new Error(`Unexpected query in control-plane idempotency store test double: ${sql}`);
    },
  };
}

test('control plane idempotency store reserves, completes, and reads a record', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });

  const reservation = await store.createInProgressRecord({
    actorUserId: 'user-1',
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-1',
  });
  const completed = await store.completeRecord({
    expiresAt: '2026-05-04T13:00:00.000Z',
    id: reservation.id,
    response: { accepted: true },
    statusCode: 202,
  });
  const record = await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-1',
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.create',
  });

  assert.equal(reservation.state, 'in_progress');
  assert.equal(completed.state, 'completed');
  assert.equal(record.idempotencyKey, 'idem-1');
  assert.equal(record.operationScope, 'recovery.backups.create');
  assert.equal(record.response.accepted, true);
  assert.equal(record.statusCode, 202);
});

test('control plane idempotency store reserves one null-actor record per scope and key', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });
  const request = {
    actorUserId: null,
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'webhook-event-1',
    operationScope: 'slskd.webhook.nudge',
    requestHash: 'hash-1',
  };

  const first = await store.createInProgressRecord(request);
  const duplicate = await store.createInProgressRecord(request);

  assert.equal(first.state, 'in_progress');
  assert.equal(duplicate, null);
});

test('control plane idempotency store deletes only an expired record by id', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });
  const reservation = await store.createInProgressRecord({
    actorUserId: 'user-2',
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.delete',
    requestHash: 'hash-2',
  });

  const unexpiredDeleted = await store.deleteExpiredRecordById({
    id: reservation.id,
    now: '2026-05-02T13:00:00.000Z',
  });
  const expiredDeleted = await store.deleteExpiredRecordById({
    id: reservation.id,
    now: '2026-05-02T15:00:00.000Z',
  });

  assert.equal(unexpiredDeleted, false);
  assert.equal(expiredDeleted, true);
  assert.equal(await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-2',
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.delete',
  }), null);
});

test('control plane idempotency store removes only an in-progress record after a failed mutation', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });
  const reservation = await store.createInProgressRecord({
    actorUserId: 'user-3',
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'idem-3',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-3',
  });

  await store.deleteInProgressRecordById({ id: reservation.id });
  assert.equal(await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-3',
    idempotencyKey: 'idem-3',
    operationScope: 'recovery.backups.create',
  }), null);
});

test('control plane idempotency store deletes expired records and leaves unexpired records intact', async () => {
  const pool = createQueryable();
  const store = createControlPlaneIdempotencyStore({ getPoolFn: () => pool });

  await store.createInProgressRecord({
    actorUserId: 'user-3',
    expiresAt: '2026-05-02T14:00:00.000Z',
    idempotencyKey: 'expired-key',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-expired',
  });
  await store.createInProgressRecord({
    actorUserId: 'user-3',
    expiresAt: '2026-05-04T13:00:00.000Z',
    idempotencyKey: 'valid-key',
    operationScope: 'recovery.backups.create',
    requestHash: 'hash-valid',
  });

  const result = await store.deleteExpiredRecords({ now: '2026-05-03T12:00:00.000Z' });

  assert.equal(result.deletedCount, 1);
  assert.equal(await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-3',
    idempotencyKey: 'expired-key',
    operationScope: 'recovery.backups.create',
  }), null);
  assert.equal((await store.getRecordByScopeActorAndKey({
    actorUserId: 'user-3',
    idempotencyKey: 'valid-key',
    operationScope: 'recovery.backups.create',
  })).idempotencyKey, 'valid-key');
});
