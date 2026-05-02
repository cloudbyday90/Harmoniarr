import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkSummaryService } from '../../src/server/artwork/artwork-summary-service.js';

test('buildArtworkSummary returns retention-aware artwork cleanup diagnostics', async () => {
  const service = createArtworkSummaryService({
    artworkCleanupRunStore: {
      getLatestRun: async () => null,
    },
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
      }),
    },
    getArtworkCleanupSnapshotFn: async () => ({
      eligibleAssetCount: 2,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 4,
    }),
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
  });

  const summary = await service.buildArtworkSummary();

  assert.equal(summary.cleanup.unassignedRetentionDays, 90);
  assert.equal(summary.cleanup.retentionCutoff, '2026-01-31T12:00:00.000Z');
  assert.equal(summary.inventory.eligibleAssetCount, 2);
  assert.equal(summary.summary.status, 'ready');
});

test('buildArtworkSummary reflects an active cleanup run before ready-state counts', async () => {
  const service = createArtworkSummaryService({
    artworkCleanupRunStore: {
      getLatestRun: async () => ({
        id: 'run-1',
        status: 'running',
      }),
    },
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
      }),
    },
    getArtworkCleanupSnapshotFn: async () => ({
      eligibleAssetCount: 4,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 5,
    }),
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
  });

  const summary = await service.buildArtworkSummary();

  assert.equal(summary.summary.status, 'running');
  assert.match(summary.summary.message, /currently removing retention-eligible assets/);
});