import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { createMediaCommandAdmission } from '../../src/server/media/media-command-admission.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';

test('native abort retains ownership through close before a queued process spawns', { timeout: 15_000 }, async () => {
  const ready = Promise.withResolvers(); const records = []; const controller = new AbortController();
  const service = createMediaCommandService({ allowedBinaries: [process.execPath],
    admission: createMediaCommandAdmission({ concurrency: 1 }), spawnFn: (...args) => {
      assert.ok(records.every(row => row.closed));
      const child = spawn(args[0], args[1], { ...args[2], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      const record = { child, closed: false }; records.push(record);
      child.once('message', () => ready.resolve()); child.once('close', () => { record.closed = true; }); return child;
    } });
  const source = "process.send('ready'); process.on('message', () => process.disconnect());";
  const first = service.runCommand({ binary: process.execPath, args: ['-e', source], signal: controller.signal });
  const rejected = assert.rejects(first, { code: 'ABORT_ERR' });
  const second = service.runCommand({ binary: process.execPath, args: ['-e', "process.stdout.write('next')"] });
  try {
    await ready.promise; controller.abort(); assert.equal(records[0].closed, false); assert.equal(records.length, 1);
    assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 1 });
    await rejected; assert.equal((await second).stdout, 'next');
    assert.ok(records.every(row => row.closed)); assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
  } finally { controller.abort(); await Promise.allSettled([rejected, second]); }
});

test('native spawn refusal returns its original ENOENT and leaves no admission holder', { timeout: 10_000 }, async () => {
  const service = createMediaCommandService();
  await assert.rejects(service.runCommand({ binary: 'harmoniarr-fixture-missing-media-binary' }), { code: 'ENOENT' });
  assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
  assert.equal((await service.runCommand({ binary: process.execPath, args: ['-e', "process.stdout.write('available')"] })).stdout, 'available');
});
