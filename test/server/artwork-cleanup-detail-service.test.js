import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkCleanupDetailService } from '../../src/server/artwork/artwork-cleanup-detail-service.js';

test('buildArtworkCleanupRunDetail returns a single persisted cleanup run', async () => {
  const service = createArtworkCleanupDetailService({
    artworkCleanupRunStore: {
      getRunById: async (runId) => ({
        id: runId,
        status: 'failed',
      }),
    },
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
  });

  const detail = await service.buildArtworkCleanupRunDetail({ runId: 'run-5' });

  assert.equal(detail.checkedAt, '2026-05-01T12:00:00.000Z');
  assert.deepEqual(detail.run, {
    id: 'run-5',
    status: 'failed',
  });
});

test('buildArtworkCleanupRunDetail throws a shared 404 when the run is missing', async () => {
  const service = createArtworkCleanupDetailService({
    artworkCleanupRunStore: {
      getRunById: async () => null,
    },
  });

  await assert.rejects(
    () => service.buildArtworkCleanupRunDetail({ runId: 'missing-run' }),
    {
      code: 'artwork_cleanup_run_not_found',
      status: 404,
    },
  );
});