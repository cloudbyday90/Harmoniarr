import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateImportPendingSummaryService } from '../../src/server/import-candidates/import-candidate-import-pending-summary-service.js';

test('buildImportPendingCandidateSummary resolves import readiness over completed download candidates', async () => {
  const service = createImportCandidateImportPendingSummaryService({
    listImportCandidates: async () => ({
      candidates: [
        {
          fileCount: 2,
          folderPath: 'Ready Folder',
          id: 'candidate-ready',
          lockedFileCount: 0,
          sourceProvider: 'slskd',
          sourceSearchId: 'search-1',
          totalSizeBytes: 2048,
          updatedAt: '2026-04-30T18:00:00.000Z',
          username: 'ready-user',
        },
        {
          fileCount: 1,
          folderPath: 'Warning Folder',
          id: 'candidate-warning',
          lockedFileCount: 0,
          sourceProvider: 'slskd',
          sourceSearchId: 'search-2',
          totalSizeBytes: 1024,
          updatedAt: '2026-04-30T19:00:00.000Z',
          username: 'warning-user',
        },
      ],
      pagination: {
        limit: 25,
        offset: 0,
        total: 2,
      },
    }),
    previewImportCandidateApply: async ({ importCandidateId }) => {
      if (importCandidateId === 'candidate-warning') {
        return {
          counts: {
            collisionCount: 0,
            missingSourceCount: 0,
            readyCount: 1,
            stagingPresentCount: 1,
            totalFiles: 1,
          },
          files: [],
          preview: {
          library: {
            previewFolderPath: '/data/music/Warning Folder',
          },
          source: {
            resolutionStrategy: 'downloads_root_relative',
            resolvedFolderPath: '/data/downloads/Warning Folder',
          },
          staging: {
            previewFolderPath: '/data/staging/import-candidates/candidate-warning/Warning Folder',
          },
          validation: {
            blockers: [],
            canPreview: true,
            warnings: [{ code: 'naming_preview_mirrors_candidate', message: 'Naming preview still mirrors the candidate-relative structure.' }],
          },
          },
          summary: {
            status: 'attention',
            message: 'Naming preview still mirrors the candidate-relative structure.',
          },
        };
      }

      return {
        counts: {
          collisionCount: 0,
          missingSourceCount: 0,
          readyCount: 1,
          stagingPresentCount: 1,
          totalFiles: 1,
        },
        files: [],
        preview: {
        library: {
          previewFolderPath: '/data/music/Ready Folder',
        },
        source: {
          resolutionStrategy: 'downloads_root_relative',
          resolvedFolderPath: '/data/downloads/Ready Folder',
        },
        staging: {
          previewFolderPath: '/data/staging/import-candidates/candidate-ready/Ready Folder',
        },
        validation: {
          blockers: [],
          canPreview: true,
          warnings: [],
        },
        },
        summary: {
          status: 'ready',
          message: '1 file is ready for a guarded import apply preview.',
        },
      };
    },
  });

  const summary = await service.buildImportPendingCandidateSummary();

  assert.equal(summary.counts.totalImportPending, 2);
  assert.equal(summary.counts.ready, 1);
  assert.equal(summary.counts.readyWithWarnings, 1);
  assert.equal(summary.summary.status, 'attention');
  assert.equal(summary.importPendingCandidates[0].importStatus.code, 'ready');
  assert.equal(summary.importPendingCandidates[1].importStatus.code, 'ready_with_warnings');
});

test('buildImportPendingCandidateSummary returns an empty summary when nothing is import pending', async () => {
  const service = createImportCandidateImportPendingSummaryService({
    listImportCandidates: async () => ({
      candidates: [],
      pagination: {
        limit: 25,
        offset: 0,
        total: 0,
      },
    }),
  });

  const summary = await service.buildImportPendingCandidateSummary();

  assert.equal(summary.counts.totalImportPending, 0);
  assert.equal(summary.summary.status, 'empty');
  assert.deepEqual(summary.importPendingCandidates, []);
});