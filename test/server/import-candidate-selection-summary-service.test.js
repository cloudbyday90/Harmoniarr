import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateSelectionSummaryService } from '../../src/server/import-candidates/import-candidate-selection-summary-service.js';

test('buildSelectedImportCandidateSummary resolves planning readiness over persisted selected candidates', async () => {
  const service = createImportCandidateSelectionSummaryService({
    listImportCandidates: async () => ({
      candidates: [
        {
          id: 'candidate-ready',
          username: 'ready-user',
          folderPath: 'Ready Folder',
          fileCount: 2,
          lockedFileCount: 0,
          totalSizeBytes: 2048,
          sourceProvider: 'slskd',
          sourceSearchId: 'search-1',
          updatedAt: '2026-04-30T18:00:00.000Z',
        },
        {
          id: 'candidate-blocked',
          username: 'blocked-user',
          folderPath: 'Blocked Folder',
          fileCount: 1,
          lockedFileCount: 0,
          totalSizeBytes: 1024,
          sourceProvider: 'slskd',
          sourceSearchId: 'search-2',
          updatedAt: '2026-04-30T19:00:00.000Z',
        },
      ],
      pagination: {
        limit: 25,
        offset: 0,
        total: 2,
      },
    }),
    previewImportCandidate: async ({ importCandidateId }) => {
      if (importCandidateId === 'candidate-blocked') {
        return {
          source: {
            resolutionStrategy: 'unresolved',
            resolvedFolderPath: null,
          },
          staging: {
            previewFolderPath: '/data/staging/import-candidates/candidate-blocked',
          },
          library: {
            previewFolderPath: '/data/music/Blocked Folder',
          },
          validation: {
            canPreview: false,
            blockers: [{ code: 'unmapped', message: 'Explicit path mapping is still required.' }],
            warnings: [],
          },
        };
      }

      return {
        source: {
          resolutionStrategy: 'mapping_absolute_source',
          resolvedFolderPath: '/data/downloads/Ready Folder',
        },
        staging: {
          previewFolderPath: '/data/staging/import-candidates/candidate-ready/Ready Folder',
        },
        library: {
          previewFolderPath: '/data/music/Ready Folder',
        },
        validation: {
          canPreview: true,
          blockers: [],
          warnings: [],
        },
      };
    },
  });

  const summary = await service.buildSelectedImportCandidateSummary();

  assert.equal(summary.counts.totalSelected, 2);
  assert.equal(summary.counts.ready, 1);
  assert.equal(summary.counts.blocked, 1);
  assert.equal(summary.summary.status, 'blocked');
  assert.equal(summary.selectedCandidates[0].executionStatus.code, 'ready');
  assert.equal(summary.selectedCandidates[1].executionStatus.code, 'blocked');
  assert.equal(summary.selectedCandidates[1].planning.primaryBlocker, 'Explicit path mapping is still required.');
});

test('buildSelectedImportCandidateSummary returns an empty summary when nothing is selected', async () => {
  const service = createImportCandidateSelectionSummaryService({
    listImportCandidates: async () => ({
      candidates: [],
      pagination: {
        limit: 25,
        offset: 0,
        total: 0,
      },
    }),
  });

  const summary = await service.buildSelectedImportCandidateSummary();

  assert.equal(summary.counts.totalSelected, 0);
  assert.equal(summary.summary.status, 'empty');
  assert.deepEqual(summary.selectedCandidates, []);
});