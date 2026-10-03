import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryDiscoveryRunService as createService } from '../../src/server/library/library-discovery-run-service.js';

const queryable = { query: async () => ({ rows: [] }) };
const createLibraryDiscoveryRunService = (options) => createService({ withTransaction: (work) => work(queryable),
  lockRunCreation: async () => {}, ...options });

test('startLibraryDiscoveryRun records a pending run for durable dispatch', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'run-1',
    status: 'pending',
  }));
  const getActiveRun = t.mock.fn(async () => null);
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryDiscoveryRunService({
    createOperationRun,
    getActiveRun,
    recordAuditEventFn,
  });

  const result = await service.startLibraryDiscoveryRun({
    requestMetadata: {
      ipAddress: '198.51.100.12',
      userAgent: 'HarmoniarrDiscoveryRunServiceTest/1.0',
    },
    triggeredByUserId: 'user-7',
  });

  assert.equal(getActiveRun.mock.callCount(), 1);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments[0], {
    queryable,
    status: 'pending',
    triggerSource: 'manual',
    triggeredByUserId: 'user-7',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(result, {
    accepted: true,
    run: {
      id: 'run-1',
      status: 'pending',
    },
  });
});

test('startLibraryDiscoveryRun rejects concurrent discovery dispatch runs', async () => {
  const service = createLibraryDiscoveryRunService({
    getActiveRun: async () => ({
      id: 'run-9',
      status: 'running',
    }),
  });

  await assert.rejects(
    () => service.startLibraryDiscoveryRun(),
    {
      code: 'library_discovery_in_progress',
      message: 'A library discovery dispatch is already running or queued',
      status: 409,
    },
  );
});

test('startLibraryDiscoveryRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createLibraryDiscoveryRunService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library discovery dispatch');
    },
  });

  await assert.rejects(
    () => service.startLibraryDiscoveryRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});

test('dispatch creation checks maintenance and active work under the same transaction lock as its required audit', async () => {
  const events = [];
  const service = createService({
    withTransaction: async (work) => {
      events.push('transaction');
      const result = await work(queryable);
      events.push('commit');
      return result;
    },
    assertMaintenanceWriteAllowed: async (input) => { assert.equal(input.queryable, queryable); events.push('maintenance'); },
    lockRunCreation: async (input) => { assert.equal(input.queryable, queryable); events.push('lock'); },
    getActiveRun: async (input) => { assert.equal(input.queryable, queryable); events.push('active'); return null; },
    createOperationRun: async (input) => { assert.equal(input.queryable, queryable); events.push('create'); return { id: 'run-locked' }; },
    recordAuditEventFn: async (_event, client) => { assert.equal(client, queryable); events.push('audit'); },
  });
  await service.startLibraryDiscoveryRun();
  assert.deepEqual(events, ['transaction', 'maintenance', 'lock', 'active', 'create', 'audit', 'commit']);
});
