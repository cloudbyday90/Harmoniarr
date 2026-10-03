import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';
import { createMediaSpectralProofService } from '../../src/server/media/media-spectral-proof-service.js';

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

test('safe auto add quality gate keeps Any available permissive without a minimum or verification requirement', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();

  const result = await service.evaluateSafeAutoAddQuality({
    applyPreview: createApplyPreview([]),
    summaryCandidate: createSummaryCandidate({
      musicQueueContext: {
        profileCode: 'any_available',
        qualityOverride: null,
      },
    }),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.profileCode, 'any_available');
});

function createReadyMp3File(bitrateKbps) {
  return createReadyFlacFile({ filename: '01 Track.mp3', sourceFile: { path: '/controlled/01 Track.mp3' },
    inspection: { warnings: [], metadata: { bitRate: bitrateKbps * 1000, channelCount: 2,
      containerFormatName: 'mp3', primaryAudioCodec: 'mp3', sampleRate: 44100 } } });
}

test('intrinsic High floor rejects measured 128 kbps and accepts 256 kbps without spectral proof', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();
  const summaryCandidate = createSummaryCandidate({ musicQueueContext: { profileCode: 'high_quality' } });
  assert.equal((await service.evaluateSafeAutoAddQuality({ summaryCandidate, applyPreview: createApplyPreview([createReadyMp3File(128)]) })).eligible, false);
  assert.equal((await service.evaluateSafeAutoAddQuality({ summaryCandidate, applyPreview: createApplyPreview([createReadyMp3File(256)]) })).eligible, true);
});

test('fallback media checks reject 128 kbps, allow measured 256 kbps and retain strict lossless spectral proof', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService({ preAddSpectralProofService: createMediaSpectralProofService() });
  const summaryCandidate = createSummaryCandidate({ musicQueueContext: { profileCode: 'lossless_archive',
    qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' } } });
  assert.equal((await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([createReadyMp3File(128)]), summaryCandidate })).eligible, false);
  assert.equal((await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([createReadyMp3File(256)]), summaryCandidate })).eligible, true);
  const lossless = await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([createReadyFlacFile()]), summaryCandidate });
  assert.equal(lossless.eligible, false);
  assert.equal(lossless.blockers[0].code, 'safe_auto_spectral_file_path_missing');
});

test('explicit shared High floor verifies measured bitrate without requiring lossless spectral proof', async () => {
  const service = createImportCandidateSafeAutoAddQualityGateService();
  for (const profileCode of ['high_quality', 'lossless_archive']) {
    const summaryCandidate = createSummaryCandidate({ musicQueueContext: { profileCode, minimumBitrateKbps: 320,
      ...(profileCode === 'lossless_archive' ? { qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted', minimumBitrateKbps: 320 } } : {}) } });
    const strictService = profileCode === 'lossless_archive'
      ? createImportCandidateSafeAutoAddQualityGateService({ preAddSpectralProofService: createMediaSpectralProofService() }) : service;
    assert.equal((await strictService.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([createReadyMp3File(256)]), summaryCandidate })).eligible, false);
    assert.equal((await strictService.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([createReadyMp3File(320)]), summaryCandidate })).eligible, true);
  }
});

test('measured codecs retain PCM WAV and Vorbis controls while renamed lossy files cannot bypass the floor', async () => {
  for (const profileCode of ['high_quality', 'lossless_archive']) {
    let proofCalls = 0;
    const service = createImportCandidateSafeAutoAddQualityGateService({ preAddSpectralProofService: {
      verifySpectralProof: async () => { proofCalls += 1; return { accepted: true }; },
    } });
    const summaryCandidate = createSummaryCandidate({ normalizedPayload: { extensions: ['flac'] },
      musicQueueContext: { profileCode, minimumBitrateKbps: 320,
        ...(profileCode === 'lossless_archive' ? { qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' } } : {}) } });
    for (const bitrate of [256, 320]) {
      const renamed = { ...createReadyMp3File(bitrate), filename: '01 Fake.flac' };
      assert.equal((await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([renamed]), summaryCandidate })).eligible, false);
    }
    for (const codec of ['pcm_s16le', 'pcm_s24le']) {
      const wav = createReadyFlacFile({ filename: '01 Track.wav', inspection: { warnings: [], metadata: {
        primaryAudioCodec: codec, containerFormatName: 'wav', bitRate: 2116800, sampleRate: 44100, channelCount: 2,
      } } });
      assert.equal((await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([wav]), summaryCandidate })).eligible, true);
    }
    const vorbis = createReadyFlacFile({ filename: '01 Track.ogg', inspection: { warnings: [], metadata: {
      primaryAudioCodec: 'vorbis', containerFormatName: 'ogg', bitRate: 320000, sampleRate: 44100, channelCount: 2,
    } } });
    assert.equal((await service.evaluateSafeAutoAddQuality({ applyPreview: createApplyPreview([vorbis]), summaryCandidate })).eligible, true);
    assert.equal(proofCalls, profileCode === 'lossless_archive' ? 3 : 0);
  }
});
