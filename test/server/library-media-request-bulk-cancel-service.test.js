import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestBulkCancelService } from '../../src/server/library/library-media-request-bulk-cancel-service.js';

function createRecordedHandler() {
  const calls = [];
  const handler = async (params) => {
    calls.push(params);
    return { mediaRequestId: params.mediaRequestId, requestState: 'cancelled', cancelledChildCount: 0 };
  };
  return { calls, handler };
}

test('bulkCancelMediaRequests rejects non-array mediaRequestIds', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: 'not-array' }),
    { code: 'validation_error', message: 'mediaRequestIds must be an array' },
  );
});

test('bulkCancelMediaRequests rejects empty mediaRequestIds', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: [] }),
    { code: 'validation_error', message: 'mediaRequestIds must contain at least one entry' },
  );
});

test('bulkCancelMediaRequests rejects mediaRequestIds exceeding max batch size', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: ids }),
    { code: 'validation_error', message: 'mediaRequestIds must contain 50 entries or less' },
  );
});

test('bulkCancelMediaRequests rejects non-string entries in mediaRequestIds', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: [123] }),
    { code: 'validation_error', message: 'mediaRequestIds[0] must be a string' },
  );
});

test('bulkCancelMediaRequests rejects empty string entries in mediaRequestIds', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: ['  '] }),
    { code: 'validation_error', message: 'mediaRequestIds[0] must not be empty' },
  );
});

test('bulkCancelMediaRequests rejects non-string reason', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: ['id-1'], reason: 123 }),
    { code: 'validation_error', message: 'reason must be a string' },
  );
});

test('bulkCancelMediaRequests rejects reason exceeding 500 characters', async () => {
  const service = createLibraryMediaRequestBulkCancelService();
  await assert.rejects(
    () => service.bulkCancelMediaRequests({ mediaRequestIds: ['id-1'], reason: 'x'.repeat(501) }),
    { code: 'validation_error', message: 'reason must be 500 characters or less' },
  );
});

test('bulkCancelMediaRequests cancels all requests successfully', async () => {
  const cancel = createRecordedHandler();
  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: cancel.handler });

  const result = await service.bulkCancelMediaRequests({
    actorUserId: 'user-1',
    actorUserRole: 'admin',
    mediaRequestIds: ['req-1', 'req-2'],
    reason: 'No longer needed',
    requestMetadata: { ipAddress: '127.0.0.1' },
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[0].mediaRequestId, 'req-1');
  assert.equal(result.results[1].ok, true);
  assert.equal(result.results[1].mediaRequestId, 'req-2');
  assert.equal(cancel.calls.length, 2);
  assert.equal(cancel.calls[0].actorUserId, 'user-1');
  assert.equal(cancel.calls[0].actorUserRole, 'admin');
  assert.equal(cancel.calls[0].reason, 'No longer needed');
  assert.equal(cancel.calls[0].mediaRequestId, 'req-1');
});

test('bulkCancelMediaRequests handles partial failures', async () => {
  const handler = async ({ mediaRequestId }) => {
    if (mediaRequestId === 'req-fail') {
      const error = new Error('Not cancellable');
      error.code = 'request_not_cancellable';
      error.status = 409;
      throw error;
    }
    return { mediaRequestId, requestState: 'cancelled' };
  };

  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: handler });

  const result = await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1', 'req-fail', 'req-3'],
  });

  assert.equal(result.total, 3);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[1].ok, false);
  assert.equal(result.results[1].error.code, 'request_not_cancellable');
  assert.equal(result.results[1].error.status, 409);
  assert.equal(result.results[2].ok, true);
});

test('bulkCancelMediaRequests handles all failures', async () => {
  const handler = async () => {
    const error = new Error('Not found');
    error.code = 'media_request_not_found';
    error.status = 404;
    throw error;
  };

  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: handler });

  const result = await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1', 'req-2'],
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 2);
  assert.equal(result.results[0].ok, false);
  assert.equal(result.results[1].ok, false);
});

test('bulkCancelMediaRequests handles unexpected errors gracefully', async () => {
  const handler = async () => {
    throw new Error('Unexpected');
  };

  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: handler });

  const result = await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1'],
  });

  assert.equal(result.total, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].error.code, 'unknown_error');
  assert.equal(result.results[0].error.status, 500);
});

test('bulkCancelMediaRequests trims whitespace from reason', async () => {
  const cancel = createRecordedHandler();
  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: cancel.handler });

  await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1'],
    reason: '  valid reason  ',
  });

  assert.equal(cancel.calls[0].reason, 'valid reason');
});

test('bulkCancelMediaRequests treats null reason as null', async () => {
  const cancel = createRecordedHandler();
  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: cancel.handler });

  await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1'],
    reason: null,
  });

  assert.equal(cancel.calls[0].reason, null);
});

test('bulkCancelMediaRequests handles max batch size of 50', async () => {
  const cancel = createRecordedHandler();
  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: cancel.handler });

  const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
  const result = await service.bulkCancelMediaRequests({
    mediaRequestIds: ids,
  });

  assert.equal(result.total, 50);
  assert.equal(result.succeeded, 50);
});

test('bulkCancelMediaRequests passes requestMetadata to cancel handler', async () => {
  const cancel = createRecordedHandler();
  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: cancel.handler });

  await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1'],
    requestMetadata: { ipAddress: '10.0.0.1', userAgent: 'test' },
  });

  assert.deepEqual(cancel.calls[0].requestMetadata, { ipAddress: '10.0.0.1', userAgent: 'test' });
});

test('bulkCancelMediaRequests returns cancel result in successful items', async () => {
  const handler = async ({ mediaRequestId }) => ({
    mediaRequestId,
    requestState: 'cancelled',
    cancelledChildCount: 3,
  });

  const service = createLibraryMediaRequestBulkCancelService({ cancelMediaRequest: handler });

  const result = await service.bulkCancelMediaRequests({
    mediaRequestIds: ['req-1'],
  });

  assert.equal(result.results[0].cancel.cancelledChildCount, 3);
  assert.equal(result.results[0].cancel.requestState, 'cancelled');
});
