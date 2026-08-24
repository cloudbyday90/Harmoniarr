import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createControlPlaneIdempotencyService } from '../../src/server/recovery/control-plane-idempotency-service.js';

function requestHash(requestPayload) {
  return createHash('sha256').update(JSON.stringify(requestPayload ?? null)).digest('hex');
}

function createService(overrides = {}) {
  const records = new Map();
  let nextId = 1;

  function recordKey(operationScope, actorUserId, idempotencyKey) {
    return `${operationScope}|${actorUserId ?? 'null'}|${idempotencyKey}`;
  }

  const idempotencyStore = {
    async completeRecord({ expiresAt, id, response, statusCode }) {
      for (const record of records.values()) {
        if (record.id === id && record.state === 'in_progress') {
          record.expiresAt = expiresAt;
          record.response = response ?? {};
          record.state = 'completed';
          record.statusCode = statusCode;
          return record;
        }
      }

      return null;
    },
    async createInProgressRecord({ actorUserId = null, expiresAt, idempotencyKey, operationScope, requestHash: hash }) {
      const key = recordKey(operationScope, actorUserId, idempotencyKey);
      if (records.has(key)) {
        return null;
      }

      const record = {
        expiresAt,
        id: `record-${nextId++}`,
        requestHash: hash,
        response: {},
        state: 'in_progress',
        statusCode: 202,
      };
      records.set(key, record);
      return record;
    },
    async deleteExpiredRecordById({ id, now }) {
      for (const [key, record] of records.entries()) {
        if (record.id === id && record.expiresAt && new Date(record.expiresAt) <= new Date(now)) {
          records.delete(key);
          return true;
        }
      }

      return false;
    },
    async deleteInProgressRecordById({ id }) {
      for (const [key, record] of records.entries()) {
        if (record.id === id && record.state === 'in_progress') {
          records.delete(key);
          return true;
        }
      }

      return false;
    },
    async getRecordByScopeActorAndKey({ actorUserId = null, idempotencyKey, operationScope }) {
      return records.get(recordKey(operationScope, actorUserId, idempotencyKey)) ?? null;
    },
  };

  return {
    records,
    service: createControlPlaneIdempotencyService({
      getNow: () => new Date('2026-05-02T12:00:00.000Z'),
      idempotencyStore,
      ...overrides,
    }),
  };
}

function mutationResult(runId) {
  return {
    body: {
      accepted: true,
      runId,
    },
    statusCode: 202,
  };
}

test('control plane idempotency service executes mutation once and replays its completed response', async () => {
  const { service } = createService();
  let callCount = 0;

  const request = {
    actorUserId: 'user-1',
    idempotencyKey: 'idem-1',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: {
      backupArtifactId: 'backup-1',
      expectedPayloadSha256: 'sha-1',
    },
  };

  const first = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });
  const second = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });

  assert.equal(callCount, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.body.runId, 'run-1');
});

test('control plane idempotency service rejects key reuse when payload hash differs', async () => {
  const { service } = createService();

  await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => mutationResult('run-1'),
    idempotencyKey: 'idem-2',
    operationScope: 'recovery.backups.restoreApply',
    requestPayload: { expectedPayloadSha256: 'sha-a' },
  });

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => mutationResult('run-2'),
      idempotencyKey: 'idem-2',
      operationScope: 'recovery.backups.restoreApply',
      requestPayload: { expectedPayloadSha256: 'sha-b' },
    }),
    {
      code: 'idempotency_key_payload_mismatch',
      status: 409,
    },
  );
});

test('control plane idempotency service reports an in-progress duplicate without running it twice', async () => {
  const { service } = createService();
  let callCount = 0;
  let releaseFirstMutation;
  let markFirstMutationStarted;
  const firstMutationStarted = new Promise((resolve) => {
    markFirstMutationStarted = resolve;
  });
  const firstMutationRelease = new Promise((resolve) => {
    releaseFirstMutation = resolve;
  });
  const request = {
    actorUserId: 'user-1',
    idempotencyKey: 'idem-concurrent',
    operationScope: 'recovery.backups.create',
    requestPayload: { format: 'archive' },
  };

  const firstRequest = service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => {
      callCount += 1;
      markFirstMutationStarted();
      await firstMutationRelease;
      return mutationResult('run-1');
    },
  });

  await firstMutationStarted;

  await assert.rejects(
    service.executeIdempotentMutation({
      ...request,
      executeMutation: async () => mutationResult(`run-${++callCount}`),
    }),
    {
      code: 'idempotency_key_in_progress',
      status: 409,
    },
  );

  assert.equal(callCount, 1);

  releaseFirstMutation();
  const firstResult = await firstRequest;
  const replayedResult = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });

  assert.equal(firstResult.replayed, false);
  assert.equal(replayedResult.replayed, true);
  assert.equal(replayedResult.body.runId, 'run-1');
  assert.equal(callCount, 1);
});

test('control plane idempotency service rejects a mismatched concurrent payload before the in-progress conflict', async () => {
  const { service } = createService();
  let releaseFirstMutation;
  let markFirstMutationStarted;
  const firstMutationStarted = new Promise((resolve) => {
    markFirstMutationStarted = resolve;
  });
  const firstMutationRelease = new Promise((resolve) => {
    releaseFirstMutation = resolve;
  });

  const firstRequest = service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => {
      markFirstMutationStarted();
      await firstMutationRelease;
      return mutationResult('run-1');
    },
    idempotencyKey: 'idem-concurrent-mismatch',
    operationScope: 'recovery.backups.create',
    requestPayload: { format: 'archive' },
  });

  await firstMutationStarted;

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => mutationResult('run-2'),
      idempotencyKey: 'idem-concurrent-mismatch',
      operationScope: 'recovery.backups.create',
      requestPayload: { format: 'compressed' },
    }),
    {
      code: 'idempotency_key_payload_mismatch',
      status: 409,
    },
  );

  releaseFirstMutation();
  await firstRequest;
});

test('control plane idempotency service releases an unsuccessful reservation for a new attempt', async () => {
  const { service } = createService();
  let callCount = 0;
  const request = {
    actorUserId: 'user-1',
    idempotencyKey: 'idem-failed-mutation',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  };

  await assert.rejects(
    service.executeIdempotentMutation({
      ...request,
      executeMutation: async () => {
        callCount += 1;
        throw new Error('temporary failure');
      },
    }),
    /temporary failure/,
  );

  const retry = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });

  assert.equal(callCount, 2);
  assert.equal(retry.replayed, false);
  assert.equal(retry.body.runId, 'run-2');
});

test('control plane idempotency service reclaims an expired in-progress reservation', async () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  const { records, service } = createService({ getNow: () => now });
  const operationScope = 'recovery.backups.create';
  const actorUserId = 'user-1';
  const idempotencyKey = 'idem-stale-reservation';
  const payload = { format: 'archive' };
  records.set(`${operationScope}|${actorUserId}|${idempotencyKey}`, {
    expiresAt: '2026-05-02T11:59:59.000Z',
    id: 'expired-reservation',
    requestHash: requestHash(payload),
    response: {},
    state: 'in_progress',
    statusCode: 202,
  });

  const result = await service.executeIdempotentMutation({
    actorUserId,
    executeMutation: async () => mutationResult('run-reclaimed'),
    idempotencyKey,
    operationScope,
    requestPayload: payload,
  });

  assert.equal(result.replayed, false);
  assert.equal(result.body.runId, 'run-reclaimed');
});

test('control plane idempotency service allows a request when no key is provided', async () => {
  const { service } = createService();
  let callCount = 0;

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => mutationResult(`run-${++callCount}`),
    idempotencyKey: null,
    operationScope: 'recovery.maintenanceLocks.release',
    requestPayload: { lockId: 'lock-1' },
  });

  assert.equal(callCount, 1);
  assert.equal(result.body.accepted, true);
  assert.equal(result.statusCode, 202);
});

test('control plane idempotency service re-executes mutation when a completed record is expired', async () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  const { service } = createService({ getNow: () => now });
  let callCount = 0;
  const request = {
    actorUserId: 'user-1',
    idempotencyKey: 'idem-expired',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  };

  const first = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });

  now.setTime(new Date('2026-05-04T13:00:00.000Z').getTime());

  const second = await service.executeIdempotentMutation({
    ...request,
    executeMutation: async () => mutationResult(`run-${++callCount}`),
  });

  assert.equal(first.replayed, false);
  assert.equal(callCount, 2);
  assert.equal(second.replayed, false);
  assert.equal(second.body.runId, 'run-2');
});

test('control plane idempotency service trims whitespace from keys and scopes records by actor', async () => {
  const { service } = createService();
  let callCount = 0;

  await service.executeIdempotentMutation({
    actorUserId: 'user-a',
    executeMutation: async () => mutationResult(`run-${++callCount}`),
    idempotencyKey: '  shared-key  ',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  });

  const replay = await service.executeIdempotentMutation({
    actorUserId: 'user-a',
    executeMutation: async () => mutationResult(`run-${++callCount}`),
    idempotencyKey: 'shared-key',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  });
  const otherActor = await service.executeIdempotentMutation({
    actorUserId: 'user-b',
    executeMutation: async () => mutationResult(`run-${++callCount}`),
    idempotencyKey: 'shared-key',
    operationScope: 'recovery.maintenanceLocks.enter',
    requestPayload: { lockType: 'maintenance' },
  });

  assert.equal(callCount, 2);
  assert.equal(replay.replayed, true);
  assert.equal(replay.body.runId, 'run-1');
  assert.equal(otherActor.replayed, false);
  assert.equal(otherActor.body.runId, 'run-2');
});

test('control plane idempotency service rejects keys exceeding the supported maximum', async () => {
  const { service } = createService();

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => mutationResult('run-1'),
      idempotencyKey: 'a'.repeat(256),
      operationScope: 'recovery.backups.create',
      requestPayload: null,
    }),
    {
      code: 'idempotency_key_invalid',
      status: 400,
    },
  );
});

test('control plane idempotency service rejects a missing operation scope when a key is provided', async () => {
  const { service } = createService();

  await assert.rejects(
    service.executeIdempotentMutation({
      actorUserId: 'user-1',
      executeMutation: async () => mutationResult('run-1'),
      idempotencyKey: 'idem-no-scope',
      requestPayload: null,
    }),
    {
      message: /operationScope is required/,
    },
  );
});

test('control plane idempotency service treats a whitespace-only key as no key', async () => {
  const { service } = createService();

  const result = await service.executeIdempotentMutation({
    actorUserId: 'user-1',
    executeMutation: async () => mutationResult('run-1'),
    idempotencyKey: '   ',
    operationScope: 'recovery.backups.create',
    requestPayload: null,
  });

  assert.equal(result.replayed, undefined);
});
