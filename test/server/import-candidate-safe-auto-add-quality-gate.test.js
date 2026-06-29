import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';

function createReadyFlacFile(overrides = {}) {
  return {
    fileId: 'file-1',
    filename: '01 Track.flac',
    inspection: {
      metadata: {
        bitDepth: 16,
        bitRate: 850000,
        channelCount: 2,
        containerFormatName: 'flac',
        primaryAudioCodec: 'flac',
        sampleRate: 44100,
        tags: {
          album: 'Album',
          artist: 'Artist',
          title: 'Track',
        },
      },
      warnings: [],
    },
    status: {
      code: 'ready',
      message: 'Ready.',
    },
    ...overrides,
  };
}

function createApplyPreview(files) {
  return {
    counts: { totalFiles: files.length },
    files,
    summary: { status: 'ready' },
  };
}

function createSummaryCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    musicQueueContext: {
      profileCode: 'lossless_archive',
      qualityOverride: null,
    },
    ...overrides,
  };
}

test('safe auto add quality gate accepts verified lossless files for strict profiles', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService({
    preAddSpectralProofService: {
      verifySpectralProof: async () => ({
        accepted: true,
        code: 'spectral_authentic',
        message: 'Authentic.',
      }),
    },
  });

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([createReadyFlacFile({
      sourceFile: { exists: true, path: '/downloads/01 Track.flac' },
    })]),
    summaryCandidate: createSummaryCandidate(),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.profileCode, 'lossless_archive');
  assert.equal(result.checkedFileCount, 1);
  assert.deepEqual(result.blockers, []);
});

test('safe auto add quality gate blocks strict profiles when ffprobe evidence is missing', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([createReadyFlacFile({
      inspection: {
        metadata: null,
        warnings: [{ code: 'media_inspection_unavailable', message: 'ffprobe is unavailable.' }],
      },
    })]),
    summaryCandidate: createSummaryCandidate(),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.blockers[0].code, 'safe_auto_media_inspection_failed');
});

test('safe auto add quality gate blocks a lossy codec inside a lossless-looking file', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([createReadyFlacFile({
      inspection: {
        metadata: {
          bitDepth: null,
          bitRate: 192000,
          channelCount: 2,
          containerFormatName: 'mp3',
          primaryAudioCodec: 'mp3',
          sampleRate: 44100,
          tags: {
            album: 'Album',
            artist: 'Artist',
            title: 'Track',
          },
        },
        warnings: [],
      },
    })]),
    summaryCandidate: createSummaryCandidate(),
  });

  assert.equal(result.eligible, false);
  assert.match(result.blockers[0].code, /below_minimum|codec_extension_mismatch/);
});

test('safe auto add quality gate blocks suspicious spectral evidence when present', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([createReadyFlacFile({
      inspection: {
        ...createReadyFlacFile().inspection,
        spectral: { verdict: 'transcoded' },
      },
    })]),
    summaryCandidate: createSummaryCandidate(),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.blockers[0].code, 'safe_auto_spectral_transcoded');
});

test('safe auto add quality gate blocks strict lossless when pre-add spectral proof is missing', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService({
    preAddSpectralProofService: {
      verifySpectralProof: async () => ({
        accepted: false,
        code: 'spectral_no_cached_proof',
        message: 'No cached spectral proof exists for this file yet.',
      }),
    },
  });

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([createReadyFlacFile({
      sourceFile: { exists: true, path: '/downloads/01 Track.flac' },
    })]),
    summaryCandidate: createSummaryCandidate(),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.blockers[0].code, 'safe_auto_spectral_no_cached_proof');
});

test('safe auto add quality gate does not enforce strict lossless checks for flexible profiles', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([]),
    summaryCandidate: createSummaryCandidate({
      musicQueueContext: {
        profileCode: 'high_quality',
        qualityOverride: null,
      },
    }),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.profileCode, 'high_quality');
});
