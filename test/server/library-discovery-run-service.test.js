import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryRunService } from '../../src/server/library/library-discovery-run-service.js';

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