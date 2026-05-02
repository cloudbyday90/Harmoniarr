import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaToolingStatusService } from '../../src/server/media/media-tooling-status-service.js';

test('media tooling status reports healthy when ffmpeg and ffprobe are available', async (t) => {
  const mediaCommandService = {
    runCommand: t.mock.fn(async () => ({ stdout: 'ok' })),
  };
  const service = createMediaToolingStatusService({
    ffmpegBinary: 'ffmpeg',
    ffprobeBinary: 'ffprobe',
    mediaCommandService,
  });

  const status = await service.getStatus();

  assert.equal(mediaCommandService.runCommand.mock.callCount(), 2);
  assert.deepEqual(status, {
    status: 'healthy',
    message: 'Media inspection tooling is available.',
    details: {
      ffmpegAvailable: true,
      ffprobeAvailable: true,
    },
  });
});

test('media tooling status reports misconfigured when binaries are missing', async (t) => {
  const mediaCommandService = {
    runCommand: t.mock.fn(async ({ binary }) => {
      const error = new Error(`${binary} not found`);
      error.code = 'ENOENT';
      throw error;
    }),
  };
  const service = createMediaToolingStatusService({
    ffmpegBinary: 'custom-ffmpeg',
    ffprobeBinary: 'custom-ffprobe',
    mediaCommandService,
  });

  const status = await service.getStatus();

  assert.equal(status.status, 'misconfigured');
  assert.equal(status.code, 'media_tooling_missing');
  assert.match(status.message, /custom-ffmpeg/);
  assert.match(status.message, /custom-ffprobe/);
  assert.deepEqual(status.details, {
    ffmpegAvailable: false,
    ffprobeAvailable: false,
  });
});

test('media tooling status reports degraded when probing fails unexpectedly', async (t) => {
  const mediaCommandService = {
    runCommand: t.mock.fn(async ({ binary }) => {
      if (binary === 'ffmpeg') {
        return { stdout: 'ok' };
      }

      const error = new Error('process timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    }),
  };
  const service = createMediaToolingStatusService({
    ffmpegBinary: 'ffmpeg',
    ffprobeBinary: 'ffprobe',
    mediaCommandService,
  });

  const status = await service.getStatus();

  assert.deepEqual(status, {
    status: 'degraded',
    code: 'media_tooling_check_failed',
    message: 'Media inspection tooling checks failed.',
    details: {
      ffmpegAvailable: true,
      ffprobeAvailable: false,
    },
  });
});
