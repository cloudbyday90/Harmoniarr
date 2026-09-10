import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestActiveService } from '../../src/server/library/library-external-request-active-service.js';

function createService(request) {
  return createLibraryExternalRequestActiveService({
    mediaRequestStore: { getMediaRequestById: async () => request },
  });
}

const activeRequest = {
  id: 'request-1',
  requestKind: 'external_url',
  requestState: 'needs_fetch',
  sourceUrl: 'https://open.spotify.com/album/album-1',
};

test('external request guard returns the currently active request', async () => {
  assert.equal(await createService(activeRequest).getActiveExternalRequest({ mediaRequestId: 'request-1' }), activeRequest);
});

test('external request guard fails safely when the request is missing', async () => {
  await assert.rejects(createService(null).getActiveExternalRequest({ mediaRequestId: 'missing' }), {
    code: 'media_request_not_found',
    status: 404,
  });
});

test('external request guard rejects requests without an external URL', async () => {
  await assert.rejects(createService({ ...activeRequest, requestKind: 'release' }).getActiveExternalRequest({ mediaRequestId: 'request-1' }), {
    code: 'media_request_not_external_url',
  });
});

for (const requestState of ['cancelled', 'needs_review', 'already_exists', 'failed', null]) {
  test(`external request guard cancels provider work for ${requestState} requests`, async () => {
    await assert.rejects(createService({ ...activeRequest, requestState }).getActiveExternalRequest({
      mediaRequestId: 'request-1',
      operationRunId: 'run-1',
    }), { code: 'operation_run_cancelled', runId: 'run-1' });
  });
}
