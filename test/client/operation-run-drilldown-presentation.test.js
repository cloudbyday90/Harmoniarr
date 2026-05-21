import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationRunDrilldown,
  getOperationRunDrilldownSummaryKeys,
} from '../../src/client/lib/operation-run-drilldown-presentation.js';

test('getOperationRunDrilldownSummaryKeys returns handled structured keys per operation type', () => {
  assert.deepEqual(getOperationRunDrilldownSummaryKeys({ operationType: 'library_organize_apply' }), ['fileResults']);
  assert.deepEqual(getOperationRunDrilldownSummaryKeys({ operationType: 'library_scan' }), ['phases']);
  assert.deepEqual(getOperationRunDrilldownSummaryKeys({ operationType: 'library_discovery_dispatch' }), ['dispatchedSearches', 'failures']);
  assert.deepEqual(getOperationRunDrilldownSummaryKeys({ operationType: 'artwork_cleanup' }), []);
});

test('buildOperationRunDrilldown maps organize summaries into metrics and file tables', () => {
  const drilldown = buildOperationRunDrilldown({
    operationType: 'library_organize_apply',
    summary: {
      failedCount: 1,
      fileResults: [
        {
          destinationPath: '/library/Autechre/Amber/01 Foil.flac',
          sourcePath: '/library/Autechre/Amber/01 old.flac',
          status: 'moved',
          transport: 'rename',
        },
        {
          destinationPath: '/library/Autechre/Amber/02 Montreal.flac',
          errorMessage: 'Destination already exists',
          sourcePath: '/library/Autechre/Amber/02 old.flac',
          status: 'failed',
        },
      ],
      movedCount: 1,
      notAttemptedCount: 0,
      outcome: 'partial',
      skippedCount: 0,
    },
  });

  assert.equal(drilldown.title, 'Organize detail');
  assert.equal(drilldown.metrics[0].value, 'Partial');
  assert.equal(drilldown.tables[0].rows[0].status, 'Applied');
  assert.equal(drilldown.tables[0].rows[1].note, 'Destination already exists');
});

test('buildOperationRunDrilldown maps scan summaries into phase timing rows', () => {
  const drilldown = buildOperationRunDrilldown({
    operationType: 'library_scan',
    summary: {
      directoriesSeen: 12,
      filesMatched: 8,
      filesSeen: 10,
      filesUnmatched: 2,
      phases: [
        { finishedAt: '2026-06-03T10:01:00.000Z', name: 'filesystem_walk', startedAt: '2026-06-03T10:00:00.000Z' },
      ],
      skippedSymlinks: 1,
      totalBytes: 1048576,
    },
  });

  assert.equal(drilldown.title, 'Scan detail');
  assert.equal(drilldown.metrics[4].value, '1.00 MB');
  assert.equal(drilldown.tables[0].rows[0].phase, 'Filesystem Walk');
  assert.equal(drilldown.tables[0].rows[0].state, 'Completed');
});

test('buildOperationRunDrilldown maps discovery summaries into dispatched and failure tables', () => {
  const drilldown = buildOperationRunDrilldown({
    operationType: 'library_discovery_dispatch',
    summary: {
      attemptedCount: 3,
      candidateCount: 6,
      dispatchedCount: 2,
      dispatchedSearches: [
        { candidateCount: 4, fileCount: 10, metadataReleaseId: 'release-1', query: 'Autechre Amber 1994 FLAC', searchId: 'search-1' },
      ],
      failedCount: 1,
      failures: [
        { code: 'discovery_dispatch_failed', message: 'slskd rejected the request', metadataReleaseId: 'release-2' },
      ],
      fileCount: 10,
      outcome: 'partial',
    },
  });

  assert.equal(drilldown.title, 'Discovery detail');
  assert.equal(drilldown.metrics[0].value, 'Partial');
  assert.equal(drilldown.tables.length, 2);
  assert.equal(drilldown.tables[0].rows[0].searchId, 'search-1');
  assert.equal(drilldown.tables[1].rows[0].code, 'discovery_dispatch_failed');
});

test('buildOperationRunDrilldown returns null for unsupported operations', () => {
  assert.equal(buildOperationRunDrilldown({ operationType: 'artwork_cleanup', summary: { scannedAssetCount: 5 } }), null);
});
