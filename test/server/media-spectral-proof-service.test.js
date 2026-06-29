import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaSpectralProofService } from '../../src/server/media/media-spectral-proof-service.js';

test('media spectral proof accepts authentic cached measurements and skips analyzer', async () => {
  let analyzerCalls = 0;
  const service = createMediaSpectralProofService({
    analyzeSpectralCutoffFn: async () => {
      analyzerCalls += 1;
      return { cutoffHz: 15000, frameCount: 1 };
    },
    hashFileFn: async () => 'CAFE',
    spectralCacheStore: {
      getCachedMeasurement: async () => ({ cutoffHz: 21000, frameCount: 42 }),
      putCachedMeasurement: async () => null,
    },
  });

  const result = await service.verifySpectralProof({
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    filePath: '/downloads/a.flac',
    sampleRate: 44100,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.code, 'spectral_authentic');
  assert.equal(result.contentHash, 'cafe');
  assert.equal(result.measuredFrom, 'cache');
  assert.equal(analyzerCalls, 0);
});

test('media spectral proof analyzes and writes the cache on a cache miss', async () => {
  const puts = [];
  const service = createMediaSpectralProofService({
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 20500, frameCount: 8, durationMs: 120 }),
    hashFileFn: async () => 'beef',
    spectralCacheStore: {
      getCachedMeasurement: async () => null,
      putCachedMeasurement: async (input) => {
        puts.push(input);
        return input;
      },
    },
  });

  const result = await service.verifySpectralProof({
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    filePath: '/downloads/a.flac',
    sampleRate: 44100,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.measuredFrom, 'analysis');
  assert.deepEqual(puts, [{
    contentHash: 'beef',
    cutoffHz: 20500,
    durationMs: 120,
    frameCount: 8,
  }]);
});

test('media spectral proof rejects cached transcoded measurements for strict lossless', async () => {
  const service = createMediaSpectralProofService({
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 21000, frameCount: 1 }),
    hashFileFn: async () => 'cafe',
    spectralCacheStore: {
      getCachedMeasurement: async () => ({ cutoffHz: 15500, frameCount: 25 }),
      putCachedMeasurement: async () => null,
    },
  });

  const result = await service.verifySpectralProof({
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    filePath: '/downloads/a.flac',
    sampleRate: 44100,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'spectral_transcoded');
  assert.equal(result.measuredFrom, 'cache');
});

test('media spectral proof blocks strict lossless when no cached proof or analyzer exists', async () => {
  const service = createMediaSpectralProofService({
    hashFileFn: async () => 'cafe',
    spectralCacheStore: {
      getCachedMeasurement: async () => null,
    },
  });

  const result = await service.verifySpectralProof({
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    filePath: '/downloads/a.flac',
    sampleRate: 44100,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'spectral_no_cached_proof');
});

test('media spectral proof skips non-lossless claims', async () => {
  const service = createMediaSpectralProofService();

  const result = await service.verifySpectralProof({
    declaredCodec: 'mp3',
    declaredExtension: 'mp3',
    filePath: '/downloads/a.mp3',
    sampleRate: 44100,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.required, false);
  assert.equal(result.code, 'spectral_not_required');
});

