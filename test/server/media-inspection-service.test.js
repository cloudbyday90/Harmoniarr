import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';

test('inspectSourceFile parses ffprobe metadata and applies policy warnings', async () => {
  const mediaCommandService = {
    runCommand: async () => ({
      stdout: JSON.stringify({
        format: {
          bit_rate: '128000',
          duration: '8123.1',
          format_name: 'flac',
        },
        streams: [{
          codec_name: 'flac',
          codec_type: 'audio',
        }],
      }),
    }),
  };
  const service = createMediaInspectionService({
    getMediaToolingStatus: async () => ({
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
      },
      status: 'healthy',
    }),
    maxDurationSeconds: 7200,
    mediaCommandService,
  });

  const inspection = await service.inspectSourceFile({ sourcePath: '/data/downloads/Artist/Album/01 Track.flac' });

  assert.equal(inspection.metadata.audioStreamCount, 1);
  assert.deepEqual(inspection.metadata.audioCodecs, ['flac']);
  assert.equal(inspection.metadata.videoStreamCount, 0);
  assert.deepEqual(inspection.metadata.videoCodecs, []);
  assert.equal(inspection.metadata.primaryAudioCodec, 'flac');
  assert.equal(inspection.metadata.streamCount, 1);
  assert.equal(inspection.metadata.containerFormatName, 'flac');
  assert.equal(inspection.metadata.durationSeconds, 8123.1);
  assert.equal(inspection.metadata.bitRate, 128000);
  assert.equal(inspection.warnings.length, 1);
  assert.equal(inspection.warnings[0].code, 'media_inspection_duration_exceeds_policy');
});

test('inspectSourceFile returns explicit unavailable warning when tooling is not ready', async () => {
  const service = createMediaInspectionService({
    mediaCommandService: {
      runCommand: async () => {
      throw new Error('exec should not be called while tooling is unavailable');
      },
    },
    getMediaToolingStatus: async () => ({
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: false,
      },
      status: 'degraded',
    }),
  });

  const inspection = await service.inspectSourceFile({ sourcePath: '/data/downloads/Artist/Album/01 Track.flac' });

  assert.equal(inspection.metadata, null);
  assert.equal(inspection.warnings.length, 1);
  assert.equal(inspection.warnings[0].code, 'media_inspection_unavailable');
});

test('inspectSourceFile returns probe warning when ffprobe execution fails', async () => {
  const service = createMediaInspectionService({
    mediaCommandService: {
      runCommand: async () => {
      throw new Error('ffprobe failed');
      },
    },
  });

  const inspection = await service.inspectSourceFile({ sourcePath: '/data/downloads/Artist/Album/01 Track.flac' });

  assert.equal(inspection.metadata, null);
  assert.equal(inspection.warnings.length, 1);
  assert.equal(inspection.warnings[0].code, 'media_inspection_probe_failed');
});