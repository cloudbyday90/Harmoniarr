import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { suite, test } from 'node:test';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';

function createFakeChildProcess({ pid = 4321 } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  return child;
}

suite('media-command-service', () => {
  test('runCommand executes allowlisted binaries with bounded output capture', async () => {
    const spawnCalls = [];
    const lifecycleEvents = [];
    const child = createFakeChildProcess();
    const service = createMediaCommandService({
      allowedBinaries: ['ffprobe'],
      defaultMaxBuffer: 4096,
      defaultTimeoutMs: 2000,
      onCommandExit(event) {
        lifecycleEvents.push({ phase: 'exit', ...event });
      },
      onCommandStart(event) {
        lifecycleEvents.push({ phase: 'start', ...event });
      },
      spawnFn(binary, args, options) {
        spawnCalls.push({ args, binary, options });
        queueMicrotask(() => {
          child.stdout.end('ok');
          child.stderr.end('');
          child.exitCode = 0;
          child.emit('close', 0, null);
        });
        return child;
      },
    });

    const result = await service.runCommand({
      args: ['-version'],
      binary: 'ffprobe',
      label: 'probe version',
    });

    assert.deepEqual(spawnCalls, [{
      args: ['-version'],
      binary: 'ffprobe',
      options: {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    }]);
    assert.equal(result.stdout, 'ok');
    assert.equal(result.stderr, '');
    assert.equal(result.exitCode, 0);
    assert.equal(result.signalCode, null);
    assert.equal(typeof result.durationMs, 'number');
    assert.deepEqual(lifecycleEvents.map((event) => event.phase), ['start', 'exit']);
    assert.equal(lifecycleEvents[0].label, 'probe version');
    assert.equal(lifecycleEvents[1].terminationReason, null);
  });

  test('runCommand rejects binaries that are not allowlisted', async () => {
    const service = createMediaCommandService({
      allowedBinaries: ['ffmpeg'],
    });

    await assert.rejects(
      () => service.runCommand({ binary: 'ffprobe' }),
      (error) => error?.code === 'media_command_binary_not_allowed',
    );
  });

  test('runCommand terminates timed out processes and reports ETIMEDOUT', async (t) => {
    const warnings = [];
    const child = createFakeChildProcess();
    child.kill = t.mock.fn((signal) => {
      if (signal === 'SIGTERM') {
        setTimeout(() => {
          child.signalCode = 'SIGTERM';
          child.emit('close', null, 'SIGTERM');
        }, 0);
      }

      return true;
    });
    const service = createMediaCommandService({
      allowedBinaries: ['ffmpeg'],
      defaultKillGraceMs: 25,
      onCommandWarning(event) {
        warnings.push(event);
      },
      spawnFn() {
        return child;
      },
    });

    await assert.rejects(
      () => service.runCommand({
        args: ['-version'],
        binary: 'ffmpeg',
        timeoutMs: 10,
      }),
      (error) => {
        assert.equal(error.code, 'ETIMEDOUT');
        assert.equal(error.timedOut, true);
        assert.equal(error.signalCode, 'SIGTERM');
        return true;
      },
    );

    assert.equal(child.kill.mock.callCount(), 1);
    assert.deepEqual(child.kill.mock.calls[0].arguments, ['SIGTERM']);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].reason, 'timeout');
  });
});
