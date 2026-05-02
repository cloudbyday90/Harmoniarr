import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalIntakeService } from '../../src/server/library/library-external-intake-service.js';

test('queueExternalMediaRequestPlanning queues a planning run and patches evidence', async (t) => {
  const run = { id: 'run-1', mediaRequestId: 'req-1', sourceProvider: 'spotify' };
  const createOperationRun = t.mock.fn(async () => run);
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createLibraryExternalIntakeService({
    createOperationRun,
    getActiveRunByMediaRequestId: async () => null,
    mediaRequestStore: { mergeMediaRequestEvidence },
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'req-1',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
      storefront: null,
    },
    triggerSource: 'request_submit',
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reusedExistingRun, false);
  assert.equal(result.run, run);
  assert.equal(createOperationRun.mock.callCount(), 1);
  assert.equal(mergeMediaRequestEvidence.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('queueExternalMediaRequestPlanning reuses an active run without creating a duplicate', async (t) => {
  const existingRun = { id: 'run-existing', mediaRequestId: 'req-1' };
  const createOperationRun = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createLibraryExternalIntakeService({
    createOperationRun,
    getActiveRunByMediaRequestId: async () => existingRun,
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'req-1',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/album/xyz',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'release',
      sourceIdentifier: 'xyz',
      storefront: null,
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reusedExistingRun, true);
  assert.equal(result.run, existingRun);
  assert.equal(createOperationRun.mock.callCount(), 0);
  assert.equal(recordAuditEventFn.mock.callCount(), 0);
});
