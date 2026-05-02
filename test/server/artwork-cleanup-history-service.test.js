import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkCleanupHistoryService } from '../../src/server/artwork/artwork-cleanup-history-service.js';

test('buildArtworkCleanupHistory returns recent runs with a bounded limit', async () => {
  const listRecentRuns = async ({ limit }) => ([
    {
      id: `run-limit-${limit}`,
      status: 'completed',
    },
  ]);
  const service = createArtworkCleanupHistoryService({
    artworkCleanupRunStore: {
      listRecentRuns,
    },
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
  });

  const history = await service.buildArtworkCleanupHistory({ limit: '99' });

  assert.equal(history.checkedAt, '2026-05-01T12:00:00.000Z');
  assert.deepEqual(history.runs, [{
    id: 'run-limit-10',
    status: 'completed',
  }]);
});