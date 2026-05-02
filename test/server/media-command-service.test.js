import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';

test('runCommand executes allowlisted binaries with hardened defaults', async (t) => {
  const execFileAsync = t.mock.fn(async () => ({ stdout: 'ok', stderr: '' }));
  const service = createMediaCommandService({
    allowedBinaries: ['ffprobe'],
    defaultMaxBuffer: 4096,
    defaultTimeoutMs: 2000,
    execFileAsync,
  });

  const result = await service.runCommand({
    args: ['-version'],
    binary: 'ffprobe',
  });

  assert.equal(execFileAsync.mock.callCount(), 1);
  assert.deepEqual(execFileAsync.mock.calls[0].arguments, [
    'ffprobe',
    ['-version'],
    {
      maxBuffer: 4096,
      shell: false,
      timeout: 2000,
      windowsHide: true,
    },
  ]);
  assert.deepEqual(result, { stdout: 'ok', stderr: '' });
});

test('runCommand rejects binaries that are not allowlisted', async () => {
  const service = createMediaCommandService({
    allowedBinaries: ['ffmpeg'],
    execFileAsync: async () => ({ stdout: '', stderr: '' }),
  });

  await assert.rejects(
    () => service.runCommand({ binary: 'ffprobe' }),
    (error) => error?.code === 'media_command_binary_not_allowed',
  );
});