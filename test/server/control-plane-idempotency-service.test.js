import assert from 'node:assert/strict';
import test from 'node:test';
import { createControlPlaneIdempotencyService } from '../../src/server/recovery/control-plane-idempotency-service.js';

function createService(overrides = {}) {
  const records = new Map();

  function recordKey(operationScope, actorUserId, idempotencyKey) {
    return `${operationScope}|${actorUserId ?? 'null'}|${idempotencyKey}`;
  }

  const defaults = {
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    async getRecordByScopeActorAndKey({ actorUserId = null, idempotencyKey, operationScope }) {
      return records.get(recordKey(operationScope, actorUserId, idempotencyKey)) ?? null;
    },
    async createRecord({
      actorUserId = null,
      expiresAt,
      idempotencyKey,
      operationScope,
      requestHash,
      response,
      statusCode,
    }) {
      const key = recordKey(operationScope, actorUserId, idempotencyKey);
      if (records.has(key)) {
        const error = new Error('duplicate key value violates unique constraint');
        error.code = '23505';
        throw error;
      }

      records.set(key, {
        id: `${key}-id`,
        expiresAt,
        requestHash,
        response,
        statusCode,
      });
    },
    async deleteRecordById({ id }) {
      for (const [key, value] of records.entries()) {
        if (value.id === id) {
          records.delete(key);
          break;
        }
      }
    },
  };

  return createControlPlaneIdempotencyService({
    ...defaults,
    ...overrides,
  });
}

test('control plane idempotency service executes mutation once and replays stored response', async () => {
  const service = createService();
  let callCount = 0;

  const first = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return {
        body: {
          accepted: true,
          runId: 'run-1',
        },
        statusCode: 202,
      };
    },
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: {
      backupArtifactId: 'backup-1',
      expectedPayloadSha256: 'sha-1',
    },
  });

  const second = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return {
        body: {
          accepted: true,
          runId: 'run-2',
        },
        statusCode: 202,
      };
    },
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: {
      backupArtifactId: 'backup-1',
      expectedPayloadSha256: 'sha-1',
    },
  });

  assert.equal(callCount, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.body.runId, 'run-1');
});

test('control plane idempotency service rejects key reuse when payload hash differs', async () => {
  const service = createService();

  await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => ({
      body: {
        accepted: true,
      },
      statusCode: 202,
    }),
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: {
      expectedPayloadSha256: 'sha-a',
    },
  });

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => ({
        body: {
          accepted: true,
        },
        statusCode: 202,
      }),
      idempotencyKey: 'idem-2',
      operationScope: 'recovery.backups.restoreApply',
      requestPayload: {
        expectedPayloadSha256: 'sha-b',
      },
    }),
    {
      code: 'idempotency_key_payload_mismatch',
      status: 409,
    },
  );
});

test('control plane idempotency service allows request when no key is provided', async () => {
  const service = createService();
  let callCount = 0;

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return {
        body: {
          accepted: true,
        },
        statusCode: 200,
      };
    },
    idempotencyKey: null,
    operationScope: 'recovery.maintenanceLocks.release',
    requestPayload: {
      lockId: 'lock-1',
    },
  });

  assert.equal(callCount, 1);
  assert.equal(result.body.accepted, true);
  assert.equal(result.statusCode, 200);
});

test('control plane idempotency service re-executes mutation when record is expired', async () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  let callCount = 0;

  const service = createService({
    getNow: () => now,
  });

  const first = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return {
        body: { accepted: true, runId: `run-${callCount}` },
        statusCode: 202,
      };
    },
    idempotencyKey: 'idem-expired',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  assert.equal(first.replayed, false);
  assert.equal(callCount, 1);

  now.setTime(new Date('2026-05-04T13:00:00.000Z').getTime());

  const second = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return {
        body: { accepted: true, runId: `run-${callCount}` },
        statusCode: 202,
      };
    },
    idempotencyKey: 'idem-expired',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  assert.equal(callCount, 2);
  assert.equal(second.replayed, false);
  assert.equal(second.body.runId, 'run-2');
});

test('control plane idempotency service handles race condition via unique constraint violation', async () => {
  const records = new Map();

  const service = createControlPlaneIdempotencyService({
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    ttlHours: 48,
    idempotencyStore: {
      async getRecordByScopeActorAndKey({ actorUserId = null, idempotencyKey, operationScope }) {
        const key = `${operationScope}|${actorUserId ?? 'null'}|${idempotencyKey}`;
        return records.get(key) ?? null;
      },
      async createRecord({ actorUserId = null, expiresAt, idempotencyKey, operationScope, requestHash, response, statusCode }) {
        const key = `${operationScope}|${actorUserId ?? 'null'}|${idempotencyKey}`;
        records.set(key, {
          id: `${key}-id`,
          expiresAt,
          requestHash,
          response,
          statusCode,
        });
      },
      async deleteRecordById() {},
    },
  });

  const first = await service.executeIdempotentMutation({
    actorUserId: 'user-race',
    executeMutation: async () => ({
      body: { accepted: true, runId: 'run-race-1' },
      statusCode: 202,
    }),
    idempotencyKey: 'idem-race',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: { backupArtifactId: 'backup-race' },
  });

  assert.equal(first.replayed, false);

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-race',
    executeMutation: async () => ({
      body: { accepted: true, runId: 'run-race-2' },
      statusCode: 202,
    }),
    idempotencyKey: 'idem-race',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: { backupArtifactId: 'backup-race' },
  });

  assert.equal(result.replayed, true);
  assert.equal(result.body.runId, 'run-race-1');
});

test('control plane idempotency service rejects keys exceeding maximum length', async () => {
  const service = createService();
  const longKey = 'a'.repeat(256);

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => ({ body: {}, statusCode: 200 }),
      idempotencyKey: longKey,
      operationScope: 'recovery.backups.create',
      requestPayload: null,
    }),
    {
      code: 'idempotency_key_invalid',
      status: 400,
    },
  );
});

test('control plane idempotency service trims whitespace from keys and replays matching key', async () => {
  const service = createService();
  let callCount = 0;

  const first = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return { body: { accepted: true, call: callCount }, statusCode: 202 };
    },
    idempotencyKey: '  idem-trim  ',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  });

  const second = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return { body: { accepted: true, call: callCount }, statusCode: 202 };
    },
    idempotencyKey: 'idem-trim',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  });

  assert.equal(callCount, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.body.call, 1);
});

test('control plane idempotency service throws when operationScope is missing with key', async () => {
  const service = createService();

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => ({ body: {}, statusCode: 200 }),
      idempotencyKey: 'idem-no-scope',
      requestPayload: null,
    }),
    {
      message: /operationScope is required/,
    },
  );
});

test('control plane idempotency service treats whitespace-only key as no key', async () => {
  const service = createService();
  let callCount = 0;

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      callCount += 1;
      return { body: { accepted: true }, statusCode: 200 };
    },
    idempotencyKey: '   ',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  assert.equal(callCount, 1);
  assert.equal(result.replayed, undefined);
});

test('control plane idempotency service scopes records by actor user id', async () => {
  const service = createService();
  let callCount = 0;

  await service.executeIdempotentMutation({
    actorUserId: 'user-a',
    executeMutation: async () => {
      callCount += 1;
      return { body: { accepted: true, actor: 'a' }, statusCode: 202 };
    },
    idempotencyKey: 'shared-key',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-b',
    executeMutation: async () => {
      callCount += 1;
      return { body: { accepted: true, actor: 'b' }, statusCode: 202 };
    },
    idempotencyKey: 'shared-key',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  assert.equal(callCount, 2);
  assert.equal(result.replayed, false);
  assert.equal(result.body.actor, 'b');
});
