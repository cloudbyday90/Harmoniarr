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

test('previewImportCandidateApply forwards target user context to preview planning', async () => {
  const previewImportCandidate = test.mock.fn(async ({ importCandidateId, targetUser }) => ({
    candidate: { id: importCandidateId },
    library: {
      targetUser,
    },
    naming: {
      filePreviews: [],
    },
    validation: {
      blockers: [],
      warnings: [],
    },
  }));
  const service = createImportCandidateApplyPreviewService({
    previewImportCandidate,
  });

  await service.previewImportCandidateApply({
    importCandidateId: 'candidate-1',
    targetUser: { id: 'user-1' },
  });

  assert.deepEqual(previewImportCandidate.mock.calls[0].arguments, [{
    importCandidateId: 'candidate-1',
    targetUser: { id: 'user-1' },
  }]);
});

test('previewImportCandidateApply surfaces media inspection warnings as attention-level summary', async () => {
  const service = createImportCandidateApplyPreviewService({
    mediaInspectionService: {
      inspectSourceFile: async () => ({
        metadata: {
          audioStreamCount: 0,
          streamCount: 1,
          videoStreamCount: 1,
        },
        warnings: [{
          code: 'media_inspection_no_audio_stream',
          message: 'The file does not expose an audio stream and may not import as expected.',
        }],
      }),
    },
    previewImportCandidate: async () => ({
      naming: {
        filePreviews: [{
          fileId: 'file-ready',
          filename: '01 Ready.flac',
          libraryPath: '/data/music/Artist/Album/01 Ready.flac',
          sourcePath: '/data/downloads/Artist/Album/01 Ready.flac',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/01 Ready.flac',
        }],
      },
      validation: {
        blockers: [],
        warnings: [],
      },
    }),
    statFn: async (pathValue) => {
      if (pathValue.includes('/data/music/')) {
        throw new Error('missing');
      }

      return {
        isDirectory: () => false,
      };
    },
  });

  const preview = await service.previewImportCandidateApply({ importCandidateId: 'candidate-1' });

  assert.equal(preview.summary.status, 'attention');
  assert.equal(preview.counts.inspectionWarningCount, 1);
  assert.equal(preview.inspectionWarnings.length, 1);
  assert.equal(preview.inspectionWarnings[0].fileId, 'file-ready');
  assert.equal(preview.files[0].inspection.warnings[0].code, 'media_inspection_no_audio_stream');
});

test('previewImportCandidateApply blocks lossy transcode candidates until explicit decision is saved', async () => {
  const service = createImportCandidateApplyPreviewService({
    mediaInspectionService: {
      inspectSourceFile: async () => ({
        metadata: {
          audioCodecs: ['mp3'],
          audioStreamCount: 1,
          streamCount: 1,
          videoStreamCount: 0,
        },
        warnings: [],
      }),
    },
    mediaTranscodePlanningService: {
      planInspection: () => ({
        mode: 'planning_only',
        rationale: 'lossy_source_detected',
        recommendedAction: 'transcode_candidate',
        target: {
          audioCodec: 'opus',
        },
        warnings: [{
          code: 'media_transcode_lossy_source_detected',
          message: 'Detected lossy source codec.',
        }],
      }),
    },
    previewImportCandidate: async () => ({
      naming: {
        filePreviews: [{
          fileId: 'file-ready',
          filename: '01 Ready.mp3',
          libraryPath: '/data/music/Artist/Album/01 Ready.mp3',
          sourcePath: '/data/downloads/Artist/Album/01 Ready.mp3',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/01 Ready.mp3',
        }],
      },
      validation: {
        blockers: [],
        warnings: [],
      },
    }),
    statFn: async (pathValue) => {
      if (pathValue.includes('/data/music/')) {
        throw new Error('missing');
      }

      return {
        isDirectory: () => false,
      };
    },
  });

  const preview = await service.previewImportCandidateApply({ importCandidateId: 'candidate-1' });

  assert.equal(preview.summary.status, 'blocked');
  assert.equal(preview.counts.transcodeWarningCount, 1);
  assert.equal(preview.counts.lossyDecisionRequiredCount, 1);
  assert.equal(preview.counts.losslessPolicyWarningCount, 1);
  assert.equal(preview.losslessPolicyWarnings.length, 1);
  assert.equal(preview.transcodeWarnings.length, 1);
  assert.equal(preview.files[0].status.code, 'blocked');
  assert.equal(preview.files[0].transcodePlan.recommendedAction, 'transcode_candidate');
  assert.equal(preview.transcodeWarnings[0].code, 'media_transcode_lossy_source_detected');
  assert.equal(preview.losslessPolicyWarnings[0].code, 'media_transcode_lossy_derivative_ack_required');
});

test('previewImportCandidateApply accepts explicit lossy derivative decisions with warning-level summary', async () => {
  const service = createImportCandidateApplyPreviewService({
    listImportCandidateFileDecisions: async () => ([{
      decisionType: 'allow_lossy_derivative',
      importCandidateFileId: 'file-ready',
      importCandidateId: 'candidate-1',
      reason: 'Allow lossy derivative for this source.',
    }]),
    mediaInspectionService: {
      inspectSourceFile: async () => ({
        metadata: {
          audioCodecs: ['mp3'],
          audioStreamCount: 1,
          streamCount: 1,
          videoStreamCount: 0,
        },
        warnings: [],
      }),
    },
    mediaTranscodePlanningService: {
      planInspection: () => ({
        mode: 'planning_only',
        rationale: 'lossy_source_detected',
        recommendedAction: 'transcode_candidate',
        target: {
          audioCodec: 'opus',
        },
        warnings: [{
          code: 'media_transcode_lossy_source_detected',
          message: 'Detected lossy source codec.',
        }],
      }),
    },
    previewImportCandidate: async () => ({
      naming: {
        filePreviews: [{
          fileId: 'file-ready',
          filename: '01 Ready.mp3',
          libraryPath: '/data/music/Artist/Album/01 Ready.mp3',
          sourcePath: '/data/downloads/Artist/Album/01 Ready.mp3',
          stagingPath: '/data/staging/import-candidates/candidate-1/Artist/Album/01 Ready.mp3',
        }],
      },
      validation: {
        blockers: [],
        warnings: [],
      },
    }),
    statFn: async (pathValue) => {
      if (pathValue.includes('/data/music/')) {
        throw new Error('missing');
      }

      return {
        isDirectory: () => false,
      };
    },
  });

  const preview = await service.previewImportCandidateApply({ importCandidateId: 'candidate-1' });

  assert.equal(preview.summary.status, 'attention');
  assert.equal(preview.files[0].status.code, 'ready');
  assert.equal(preview.files[0].decision.decisionType, 'allow_lossy_derivative');
  assert.equal(preview.losslessPolicyWarnings[0].code, 'media_transcode_lossy_derivative_acknowledged');
});