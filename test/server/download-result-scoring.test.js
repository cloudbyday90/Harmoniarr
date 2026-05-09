import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scoreAudioDepth,
  scoreDownloadResult,
  scoreDuration,
  scoreFormatConsistency,
  scoreFormatTier,
  scorePeerDelivery,
  scoreTrackCount,
  scoreUploaderReputation,
} from '../../src/server/library/download-result-scoring.js';

test('scoreFormatTier returns 100 for all-lossless when preferring FLAC', () => {
  const result = scoreFormatTier({ preferredFormat: 'flac', extensions: ['flac'], files: [] });
  assert.equal(result.score, 100);
});

test('scoreFormatTier returns 80 for mixed lossless+lossy when preferring FLAC', () => {
  const result = scoreFormatTier({ preferredFormat: 'flac', extensions: ['flac', 'mp3'], files: [] });
  assert.equal(result.score, 80);
});

test('scoreFormatTier returns 40 for all-lossy when preferring FLAC', () => {
  const result = scoreFormatTier({ preferredFormat: 'flac', extensions: ['mp3'], files: [] });
  assert.equal(result.score, 40);
});

test('scoreFormatTier returns 90 for all-lossless when preferring mp3_320', () => {
  const result = scoreFormatTier({ preferredFormat: 'mp3_320', extensions: ['flac'], files: [] });
  assert.equal(result.score, 90);
});

test('scoreFormatTier returns 80 for all-lossy when preferring mp3_320', () => {
  const result = scoreFormatTier({ preferredFormat: 'mp3_320', extensions: ['mp3'], files: [] });
  assert.equal(result.score, 80);
});

test('scoreFormatTier returns 100 for lossless with minimumQuality lossless', () => {
  const result = scoreFormatTier({ minimumQuality: 'lossless', extensions: ['flac'], files: [] });
  assert.equal(result.score, 100);
});

test('scoreFormatTier returns 20 for lossy with minimumQuality lossless', () => {
  const result = scoreFormatTier({ minimumQuality: 'lossless', extensions: ['mp3'], files: [] });
  assert.equal(result.score, 20);
});

test('scoreFormatTier returns 100 for lossless with minimumQuality high', () => {
  const result = scoreFormatTier({ minimumQuality: 'high', extensions: ['flac'], files: [] });
  assert.equal(result.score, 100);
});

test('scoreFormatTier returns 80 for mp3 320 with minimumQuality high', () => {
  const result = scoreFormatTier({
    minimumQuality: 'high',
    extensions: ['mp3'],
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 80);
});

test('scoreFormatTier returns 100 for any format with lossless files', () => {
  const result = scoreFormatTier({ extensions: ['flac'], files: [] });
  assert.equal(result.score, 100);
});

test('scoreFormatTier returns 0 for no extensions', () => {
  const result = scoreFormatTier({ extensions: [], files: [] });
  assert.equal(result.score, 0);
});

test('scoreAudioDepth returns 100 for high-res lossless', () => {
  const result = scoreAudioDepth({
    files: [{ extension: 'flac', bitDepth: 24, sampleRateHz: 96000 }],
  });
  assert.equal(result.score, 100);
});

test('scoreAudioDepth returns 90 for standard lossless', () => {
  const result = scoreAudioDepth({
    files: [
      { extension: 'flac', bitDepth: 16, sampleRateHz: 44100 },
      { extension: 'flac', bitDepth: 16, sampleRateHz: 44100 },
    ],
  });
  assert.equal(result.score, 90);
});

test('scoreAudioDepth returns 60 for high-bitrate lossy', () => {
  const result = scoreAudioDepth({
    files: [{ extension: 'mp3', bitRateKbps: 320 }],
  });
  assert.equal(result.score, 60);
});

test('scoreAudioDepth returns 20 for low-bitrate lossy', () => {
  const result = scoreAudioDepth({
    files: [{ extension: 'mp3', bitRateKbps: 128 }],
  });
  assert.equal(result.score, 20);
});

test('scoreAudioDepth returns 50 for no files', () => {
  const result = scoreAudioDepth({ files: [] });
  assert.equal(result.score, 50);
});

test('scoreTrackCount returns 100 for exact match', () => {
  const result = scoreTrackCount({ candidateFileCount: 10, expectedTrackCount: 10 });
  assert.equal(result.score, 100);
});

test('scoreTrackCount returns 100 for more files than expected', () => {
  const result = scoreTrackCount({ candidateFileCount: 12, expectedTrackCount: 10 });
  assert.equal(result.score, 100);
});

test('scoreTrackCount returns 80 for 90% match', () => {
  const result = scoreTrackCount({ candidateFileCount: 9, expectedTrackCount: 10 });
  assert.equal(result.score, 80);
});

test('scoreTrackCount returns 60 for 75% match', () => {
  const result = scoreTrackCount({ candidateFileCount: 8, expectedTrackCount: 10 });
  assert.equal(result.score, 60);
});

test('scoreTrackCount returns 20 for less than half', () => {
  const result = scoreTrackCount({ candidateFileCount: 3, expectedTrackCount: 10 });
  assert.equal(result.score, 20);
});

test('scoreTrackCount returns 0 for zero files', () => {
  const result = scoreTrackCount({ candidateFileCount: 0, expectedTrackCount: 10 });
  assert.equal(result.score, 0);
});

test('scoreTrackCount returns 50 when no expected count', () => {
  const result = scoreTrackCount({ candidateFileCount: 10, expectedTrackCount: null });
  assert.equal(result.score, 50);
});

test('scoreDuration returns 100 for near-exact match', () => {
  const result = scoreDuration({ candidateDurationSeconds: 3600, expectedDurationSeconds: 3600 });
  assert.equal(result.score, 100);
});

test('scoreDuration returns 80 for 85-115% range', () => {
  const result = scoreDuration({ candidateDurationSeconds: 3200, expectedDurationSeconds: 3600 });
  assert.equal(result.score, 80);
});

test('scoreDuration returns 60 for 70-130% range', () => {
  const result = scoreDuration({ candidateDurationSeconds: 2700, expectedDurationSeconds: 3600 });
  assert.equal(result.score, 60);
});

test('scoreDuration returns 50 when no expected duration', () => {
  const result = scoreDuration({ candidateDurationSeconds: 3600, expectedDurationSeconds: null });
  assert.equal(result.score, 50);
});

test('scoreFormatConsistency returns 100 for single format', () => {
  const result = scoreFormatConsistency({ extensions: ['flac', 'flac', 'flac'] });
  assert.equal(result.score, 100);
});

test('scoreFormatConsistency returns 70 for two formats', () => {
  const result = scoreFormatConsistency({ extensions: ['flac', 'mp3'] });
  assert.equal(result.score, 70);
});

test('scoreFormatConsistency returns 40 for three or more formats', () => {
  const result = scoreFormatConsistency({ extensions: ['flac', 'mp3', 'ogg'] });
  assert.equal(result.score, 40);
});

test('scoreFormatConsistency returns 50 for no extensions', () => {
  const result = scoreFormatConsistency({ extensions: [] });
  assert.equal(result.score, 50);
});

test('scorePeerDelivery returns high score for free slot + fast speed + low queue', () => {
  const result = scorePeerDelivery({
    hasFreeUploadSlot: true,
    queueLength: 0,
    uploadSpeed: 15_000_000,
  });
  assert.equal(result.score, 100);
});

test('scorePeerDelivery returns moderate score with no data', () => {
  const result = scorePeerDelivery({});
  assert.equal(result.score, 50);
});

test('scorePeerDelivery penalizes long queue and slow speed', () => {
  const result = scorePeerDelivery({
    hasFreeUploadSlot: false,
    queueLength: 10,
    uploadSpeed: 50000,
  });
  assert.equal(result.score, 30);
});

test('scoreUploaderReputation returns 50 for insufficient samples', () => {
  const result = scoreUploaderReputation({ successCount: 3, failureCount: 1 });
  assert.equal(result.score, 50);
});

test('scoreUploaderReputation returns 100 for high success rate', () => {
  const result = scoreUploaderReputation({ successCount: 9, failureCount: 1 });
  assert.equal(result.score, 100);
});

test('scoreUploaderReputation returns 80 for 70% success', () => {
  const result = scoreUploaderReputation({ successCount: 7, failureCount: 3 });
  assert.equal(result.score, 80);
});

test('scoreUploaderReputation returns 20 for low success rate', () => {
  const result = scoreUploaderReputation({ successCount: 1, failureCount: 9 });
  assert.equal(result.score, 20);
});

test('scoreUploaderReputation returns 50 for zero history', () => {
  const result = scoreUploaderReputation({ successCount: 0, failureCount: 0 });
  assert.equal(result.score, 50);
});

test('scoreDownloadResult computes weighted composite score', () => {
  const result = scoreDownloadResult({
    candidate: {
      extensions: ['flac'],
      fileCount: 10,
      files: Array.from({ length: 10 }, () => ({
        extension: 'flac',
        bitDepth: 16,
        sampleRateHz: 44100,
        lengthSeconds: 360,
      })),
      normalizedPayload: {
        extensions: ['flac'],
        fileCount: 10,
        hasFreeUploadSlot: true,
        queueLength: 0,
        uploadSpeed: 10_000_000,
      },
    },
    formatPreferences: { preferredFormat: 'flac', minimumQuality: 'any' },
    expectedTrackCount: 10,
    expectedDurationSeconds: 3600,
    uploaderReputation: { successCount: 9, failureCount: 1 },
  });

  assert.ok(result.compositeScore >= 90, `Expected >= 90, got ${result.compositeScore}`);
  assert.equal(result.breakdown.length, 7);
  assert.equal(result.breakdown[0].name, 'formatTier');
  assert.equal(result.breakdown[0].score, 100);
});

test('scoreDownloadResult returns null composite when no scorers match', () => {
  const result = scoreDownloadResult({
    candidate: { normalizedPayload: {} },
    scorers: [],
  });

  assert.equal(result.compositeScore, null);
  assert.deepEqual(result.breakdown, []);
});

test('scoreDownloadResult handles candidate without normalizedPayload', () => {
  const result = scoreDownloadResult({
    candidate: {
      extensions: ['mp3'],
      fileCount: 5,
      files: [{ extension: 'mp3', bitRateKbps: 320, lengthSeconds: 200 }],
    },
  });

  assert.ok(typeof result.compositeScore === 'number');
  assert.ok(result.breakdown.length > 0);
});

test('scoreDownloadResult uses default weights when none provided', () => {
  const result = scoreDownloadResult({
    candidate: {
      extensions: ['flac'],
      files: [{ extension: 'flac', bitDepth: 16, sampleRateHz: 44100, lengthSeconds: 300 }],
      normalizedPayload: { extensions: ['flac'] },
    },
    expectedTrackCount: 10,
  });

  assert.ok(typeof result.compositeScore === 'number');
  const formatEntry = result.breakdown.find((b) => b.name === 'formatTier');
  assert.equal(formatEntry.weight, 0.30);
});

test('scoreDownloadResult skips uploaderReputation when reputation is null', () => {
  const result = scoreDownloadResult({
    candidate: {
      extensions: ['flac'],
      files: [{ extension: 'flac', lengthSeconds: 300 }],
      normalizedPayload: { extensions: ['flac'] },
    },
    uploaderReputation: null,
  });

  const repEntry = result.breakdown.find((b) => b.name === 'uploaderReputation');
  assert.equal(repEntry, undefined);
  assert.ok(result.compositeScore > 0);
});

test('scoreDownloadResult scores uploaderReputation at 50 when reputation is provided with zero history', () => {
  const result = scoreDownloadResult({
    candidate: {
      extensions: ['flac'],
      files: [{ extension: 'flac', lengthSeconds: 300 }],
      normalizedPayload: { extensions: ['flac'] },
    },
    uploaderReputation: { successCount: 0, failureCount: 0 },
  });

  const repEntry = result.breakdown.find((b) => b.name === 'uploaderReputation');
  assert.equal(repEntry.score, 50);
});
