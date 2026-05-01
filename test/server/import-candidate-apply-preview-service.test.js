import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';

test('previewImportCandidateApply reports ready, collision, and missing-source file states', async () => {
  const service = createImportCandidateApplyPreviewService({
    previewImportCandidate: async () => ({
      naming: {
        filePreviews: [{
          fileId: 'file-ready',
          filename: '01 Ready.flac',
          libraryPath: '/data/music/Artist/Album/01 Ready.flac',
          sourcePath: '/data/downloads/Artist/Album/01 Ready.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/01 Ready.flac',
        }, {
          fileId: 'file-collision',
          filename: '02 Collision.flac',
          libraryPath: '/data/music/Artist/Album/02 Collision.flac',
          sourcePath: '/data/downloads/Artist/Album/02 Collision.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/02 Collision.flac',
        }, {
          fileId: 'file-missing',
          filename: '03 Missing.flac',
          libraryPath: '/data/music/Artist/Album/03 Missing.flac',
          sourcePath: '/data/downloads/Artist/Album/03 Missing.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/03 Missing.flac',
        }],
      },
      validation: {
        blockers: [],
        warnings: [],
      },
    }),
    statFn: async (pathValue) => {
      if (pathValue.includes('03 Missing.flac')) {
        throw new Error('missing');
      }

      if (pathValue.includes('/data/music/') && !pathValue.includes('02 Collision.flac')) {
        throw new Error('missing');
      }

      return {
        isDirectory: () => false,
      };
    },
  });

  const preview = await service.previewImportCandidateApply({ importCandidateId: 'candidate-1' });

  assert.equal(preview.counts.totalFiles, 3);
  assert.equal(preview.counts.readyCount, 1);
  assert.equal(preview.counts.collisionCount, 1);
  assert.equal(preview.counts.missingSourceCount, 1);
  assert.equal(preview.files[0].status.code, 'ready');
  assert.equal(preview.files[1].status.code, 'collision');
  assert.equal(preview.files[2].status.code, 'blocked');
});

test('previewImportCandidateApply treats saved skip decisions as warning-level skips', async () => {
  const service = createImportCandidateApplyPreviewService({
    listImportCandidateFileDecisions: async () => ([{
      decisionType: 'skip',
      importCandidateFileId: 'file-collision',
      importCandidateId: 'candidate-1',
      reason: 'Keep the existing library copy.',
    }]),
    previewImportCandidate: async () => ({
      naming: {
        filePreviews: [{
          fileId: 'file-ready',
          filename: '01 Ready.flac',
          libraryPath: '/data/music/Artist/Album/01 Ready.flac',
          sourcePath: '/data/downloads/Artist/Album/01 Ready.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/01 Ready.flac',
        }, {
          fileId: 'file-collision',
          filename: '02 Collision.flac',
          libraryPath: '/data/music/Artist/Album/02 Collision.flac',
          sourcePath: '/data/downloads/Artist/Album/02 Collision.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/02 Collision.flac',
        }],
      },
      validation: {
        blockers: [],
        warnings: [],
      },
    }),
    statFn: async (pathValue) => {
      if (pathValue.includes('/data/music/') && !pathValue.includes('02 Collision.flac')) {
        throw new Error('missing');
      }

      return {
        isDirectory: () => false,
      };
    },
  });

  const preview = await service.previewImportCandidateApply({ importCandidateId: 'candidate-1' });

  assert.equal(preview.counts.totalFiles, 2);
  assert.equal(preview.counts.readyCount, 1);
  assert.equal(preview.counts.collisionCount, 0);
  assert.equal(preview.counts.skippedCount, 1);
  assert.equal(preview.summary.status, 'attention');
  assert.equal(preview.files[1].status.code, 'skipped');
  assert.equal(preview.files[1].decision.decisionType, 'skip');
});