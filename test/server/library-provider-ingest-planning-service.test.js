import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryProviderIngestPlanningService } from '../../src/server/library/library-provider-ingest-planning-service.js';

test('planExternalMediaRequest builds ingest plan for external_url request and patches evidence', async (t) => {
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const replaceProviderIngestRequests = t.mock.fn(async ({ providerIngestRequests }) => providerIngestRequests.map((r, i) => ({ ...r, id: `ingest-${i}` })));
  const recordAuditEventFn = t.mock.fn(async () => {});

  const mediaRequest = {
    id: 'req-1',
    requestKind: 'external_url',
    requestState: 'needs_fetch',
    sourceUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
  };

  const service = createLibraryProviderIngestPlanningService({
    mediaRequestStore: {
      getMediaRequestById: async () => mediaRequest,
      mergeMediaRequestEvidence,
    },
    providerIngestRequestStore: {
      replaceProviderIngestRequests,
    },
    recordAuditEventFn,
  });

  const result = await service.planExternalMediaRequest({ mediaRequestId: 'req-1', operationRunId: 'run-1' });

  assert.equal(result.mediaRequestId, 'req-1');
  assert.equal(result.providerIngestRequests.length, 1);
  assert.equal(result.normalizedSource.provider, 'spotify');
  assert.equal(result.normalizedSource.resourceType, 'playlist');
  assert.equal(replaceProviderIngestRequests.mock.callCount(), 1);
  assert.equal(mergeMediaRequestEvidence.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('planExternalMediaRequest rejects when media request not found', async () => {
  const service = createLibraryProviderIngestPlanningService({
    mediaRequestStore: {
      getMediaRequestById: async () => null,
      mergeMediaRequestEvidence: async () => {},
    },
    providerIngestRequestStore: {
      replaceProviderIngestRequests: async () => [],
    },
  });

  await assert.rejects(
    service.planExternalMediaRequest({ mediaRequestId: 'missing-req' }),
    (error) => error?.code === 'media_request_not_found',
  );
});

test('planExternalMediaRequest rejects when request kind is not external_url', async () => {
  const service = createLibraryProviderIngestPlanningService({
    mediaRequestStore: {
      getMediaRequestById: async () => ({
        id: 'req-1',
        requestKind: 'release',
        sourceUrl: null,
      }),
      mergeMediaRequestEvidence: async () => {},
    },
    providerIngestRequestStore: {
      replaceProviderIngestRequests: async () => [],
    },
  });

  await assert.rejects(
    service.planExternalMediaRequest({ mediaRequestId: 'req-1' }),
    (error) => error?.code === 'media_request_not_external_url',
  );
});

test('planExternalMediaRequest rejects when provider URL is unsupported', async () => {
  const service = createLibraryProviderIngestPlanningService({
    mediaRequestStore: {
      getMediaRequestById: async () => ({
        id: 'req-1',
        requestKind: 'external_url',
        sourceUrl: 'https://example.com/unsupported',
      }),
      mergeMediaRequestEvidence: async () => {},
    },
    providerIngestRequestStore: {
      replaceProviderIngestRequests: async () => [],
    },
  });

  await assert.rejects(
    service.planExternalMediaRequest({ mediaRequestId: 'req-1' }),
    (error) => error?.code === 'provider_url_not_supported',
  );
});
