import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';

test('executeCandidate bypasses preflight when transcode is not required', async () => {
  const service = createMediaTranscodeExecutionService({
    mediaCommandService: {
      runCommand: async () => ({ stdout: '' }),
    },
  });

  const result = await service.executeCandidate({
    sourcePath: '/downloads/Autechre/Amber/01 Foil.flac',
    transcodePlan: {
      recommendedAction: 'keep_original',
    },
  });

  assert.equal(result.status, 'not_required');
  assert.equal(result.warnings.length, 0);
});

test('executeCandidate reports tooling-unavailable when ffmpeg readiness is degraded', async () => {
  const service = createMediaTranscodeExecutionService({
    getMediaToolingStatus: async () => ({
      details: {
        ffmpegAvailable: false,
      },
      status: 'misconfigured',
    }),
    mediaCommandService: {
      runCommand: async () => ({ stdout: '' }),
    },
  });

  const result = await service.executeCandidate({
    sourcePath: '/downloads/Autechre/Amber/01 Foil.mp3',
    transcodePlan: {
      recommendedAction: 'transcode_candidate',
      target: {
        audioCodec: 'opus',
      },
    },
  });

  assert.equal(result.status, 'tooling_unavailable');
  assert.equal(result.warnings[0].code, 'media_transcode_execution_tooling_unavailable');
});

test('executeCandidate runs ffmpeg preflight and reports pass/fail status', async (t) => {
  const mediaCommandService = {
    runCommand: t.mock.fn(async () => ({ stdout: '' })),
  };
  const service = createMediaTranscodeExecutionService({
    ffmpegBin: 'ffmpeg',
    mediaCommandService,
  });

  const passed = await service.executeCandidate({
    sourcePath: '/downloads/Autechre/Amber/01 Foil.mp3',
    transcodePlan: {
      recommendedAction: 'transcode_candidate',
      target: {
        audioCodec: 'opus',
      },
    },
  });

  assert.equal(passed.status, 'preflight_passed');
  assert.equal(mediaCommandService.runCommand.mock.callCount(), 1);
  assert.equal(mediaCommandService.runCommand.mock.calls[0].arguments[0].binary, 'ffmpeg');

  mediaCommandService.runCommand.mock.mockImplementation(async () => {
    throw new Error('ffmpeg failed');
  });

  const failed = await service.executeCandidate({
    sourcePath: '/downloads/Autechre/Amber/01 Foil.mp3',
    transcodePlan: {
      recommendedAction: 'transcode_candidate',
      target: {
        audioCodec: 'opus',
      },
    },
  });

  assert.equal(failed.status, 'preflight_failed');
  assert.equal(failed.warnings[0].code, 'media_transcode_execution_preflight_failed');
});