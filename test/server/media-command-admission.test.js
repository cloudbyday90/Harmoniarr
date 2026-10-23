import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createMediaCommandAdmission } from '../../src/server/media/media-command-admission.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';

function fixture({ policy = {}, ...options } = {}) {
  const children = []; const launches = [];
  const service = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe'],
    admission: createMediaCommandAdmission({ concurrency: 1, ...policy }), ...options,
    spawnFn: (...args) => {
      launches.push(args); const child = new EventEmitter();
      Object.assign(child, { pid: 4321, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kills: [] });
      child.kill = signal => { child.kills.push(signal); return true; };
      child.finish = (code = 0, signal = null) => { child.exitCode = code; child.signalCode = signal; child.emit('close', code, signal); };
      children.push(child); return child;
    } });
  const run = (input = {}) => service.runCommand({ binary: 'ffprobe', args: ['-version'], ...input });
  return { service, children, launches, run };
}

test('canonical defaults bound active commands and refuse a full FIFO without spawning', async () => {
  const { run, service, children } = fixture({ policy: { concurrency: 2 } });
  const work = Array.from({ length: 18 }, () => run());
  assert.deepEqual(service.getAdmissionState(), { active: 2, queued: 16 });
  await assert.rejects(run(), { code: 'MEDIA_COMMAND_CAPACITY' }); assert.equal(children.length, 2);
  for (let i = 0; i < 18; i++) { children[i].finish(); await work[i]; }
  assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
});

test('queued commands retain FIFO order and immutable arguments across callers', async () => {
  const { run, children, launches } = fixture(); const first = run();
  const args = ['original']; const second = run({ binary: 'ffmpeg', args }); args[0] = 'mutated';
  const third = run({ args: ['last'] });
  children[0].finish(); await first; assert.deepEqual(launches[1][1], ['original']);
  children[1].finish(); await second; assert.deepEqual(launches[2][1], ['last']); children[2].finish(); await third;
});

test('pre-abort and queued abort never spawn; cancellation frees a waiter for FIFO progress', async () => {
  const { run, service, children } = fixture({ policy: { maxQueued: 1 } }); const controller = new AbortController();
  controller.abort(); await assert.rejects(run({ signal: controller.signal }), { code: 'ABORT_ERR' }); assert.equal(children.length, 0);
  const first = run(); const queuedController = new AbortController(); const second = run({ signal: queuedController.signal });
  const rejected = assert.rejects(second, { code: 'ABORT_ERR' }); queuedController.abort(); await rejected;
  assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 0 });
  const third = run(); children[0].finish(); await first; children[1].finish(); await third;
});

test('queue deadline refuses stale work before launch while execution remains owned', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { run, children, service } = fixture({ policy: { queueTimeoutMs: 15 } });
  const first = run(); const second = run(); const refused = assert.rejects(second, { code: 'MEDIA_COMMAND_CAPACITY' });
  t.mock.timers.tick(15); await refused; assert.equal(children.length, 1);
  assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 0 }); children[0].finish(); await first;
});

test('abort, timeout and output refusal retain capacity through exit and actual close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const reason of ['abort', 'timeout', 'output']) {
    const controller = new AbortController(); const { run, children, service } = fixture();
    const first = run({ signal: controller.signal, timeoutMs: 10, maxBuffer: 4, killGraceMs: 5 });
    const rejection = assert.rejects(first, { code: { abort: 'ABORT_ERR', timeout: 'ETIMEDOUT', output: 'MEDIA_COMMAND_MAX_BUFFER_EXCEEDED' }[reason] });
    const second = run();
    if (reason === 'abort') controller.abort(); else if (reason === 'timeout') t.mock.timers.tick(10); else children[0].stdout.write('12345');
    assert.deepEqual(children[0].kills, ['SIGTERM']); t.mock.timers.tick(5); assert.deepEqual(children[0].kills, ['SIGTERM', 'SIGKILL']);
    children[0].exitCode = 0; children[0].emit('exit', 0, null);
    assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 1 }); assert.equal(children.length, 1);
    children[0].finish(); await rejection; children[1].finish(); await second;
  }
});

test('first child Error/null survives later errors and retains the slot until close', async () => {
  for (const original of [new Error('original'), null]) {
    const { run, children, service } = fixture(); const first = run(); const rejected = assert.rejects(first, error => error === original);
    const second = run(); children[0].emit('error', original); children[0].emit('error', new Error('later'));
    assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 1 }); assert.equal(children.length, 1);
    children[0].finish(1); await rejected; children[1].finish(); await second;
  }
});

test('failed kill and throwing warnings cannot retire an active command before close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = new Error('kill failed'); const controller = new AbortController();
  const { run, children, service } = fixture({ onCommandWarning: () => { throw new Error('diagnostic'); } });
  const first = run({ signal: controller.signal, killGraceMs: 5 }); const rejected = assert.rejects(first, error => error === original);
  children[0].kill = () => { throw original; }; const second = run(); controller.abort(); t.mock.timers.tick(5);
  assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 1 }); assert.equal(children.length, 1);
  children[0].finish(1); await rejected; children[1].finish(); await second;
});

test('synchronous spawn failure releases capacity and diagnostics cannot orphan a child', async () => {
  const original = new Error('spawn refused');
  const failed = createMediaCommandService({ spawnFn: () => { throw original; } });
  await assert.rejects(failed.runCommand({ binary: 'ffprobe' }), error => error === original);
  assert.deepEqual(failed.getAdmissionState(), { active: 0, queued: 0 });
  const { run, children, service } = fixture({ onCommandStart: () => { throw new Error('diagnostic'); },
    onCommandExit: async () => { throw new Error('optional async diagnostic'); } });
  const work = run(); assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 0 }); children[0].finish(); await work;
  assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
});

test('invalid or oversized input is refused before admission and errors omit private arguments', async () => {
  const { run, service, children } = fixture();
  for (const input of [{ args: ['x'.repeat(65537)] }, { args: [null] }, { args: Array(257).fill('x') }, { maxBuffer: Infinity },
    { timeoutMs: -1 }, { killGraceMs: 0 }, { signal: {} }, { args: ['\0'] }]) await assert.rejects(run(input), TypeError);
  await assert.rejects(run({ binary: '/private/not-allowed' }), error => error.code === 'media_command_binary_not_allowed' && !error.message.includes('/private'));
  assert.equal(children.length, 0); assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
});
