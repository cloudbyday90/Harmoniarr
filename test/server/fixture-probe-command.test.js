/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { executeFixtureProbeCommand } from '../../testing/integration/fixture-probe-command.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

function fake() {
  const child = new EventEmitter(); let callback; let options;
  return { child, get callback() { return callback; }, get options() { return options; },
    execFileFn: (_binary, _args, selected, complete) => { options = selected; callback = complete; return child; } };
}

test('probe command waits beyond returned callback and process exit for actual stdio close', async () => {
  const f = fake(); let returned = false;
  const task = executeFixtureProbeCommand('controlled', [], { execFileFn: f.execFileFn }).then(value => { returned = true; return value; });
  assert.equal(f.options.timeout, 30_000); assert.equal(f.options.killSignal, 'SIGKILL');
  assert.equal(f.options.shell, false); assert.equal(f.options.windowsHide, true); assert.equal(f.options.maxBuffer, 2 * 1024 * 1024);
  f.callback(null, 'complete output', ''); f.child.emit('exit', 0, null); await Promise.resolve();
  assert.equal(returned, false); f.child.emit('close', 0, null);
  assert.deepEqual(await task, { stdout: 'complete output', stderr: '' });
  assert.equal(f.child.listenerCount('error'), 0);
});

for (const first of ['command', 'abort']) {
  test(`probe close retains the first ${first} failure through later failure`, async () => {
    const f = fake(); const controller = new AbortController(); const primary = new Error('private command'); let returned = false;
    const task = executeFixtureProbeCommand('controlled', [], { signal: controller.signal, execFileFn: f.execFileFn });
    const observed = task.catch(() => { returned = true; });
    if (first === 'command') { f.callback(primary, '', ''); controller.abort(null); }
    else { controller.abort(null); f.callback(primary, '', ''); }
    await Promise.resolve(); assert.equal(returned, false); f.child.emit('close', null, 'SIGKILL');
    await assert.rejects(task, error => error === (first === 'command' ? primary : null)); await observed;
  });
}

test('pre-aborted commands preserve null and never spawn', async () => {
  const controller = new AbortController(); controller.abort(null);
  await assert.rejects(executeFixtureProbeCommand('unused', [], { signal: controller.signal,
    execFileFn: () => assert.fail('Spawned') }), error => error === null);
});

test('native probe captures actual child output through close', async () => {
  assert.deepEqual(await executeFixtureProbeCommand(process.execPath, ['--input-type=module', '-e', 'process.stdout.write("current output")']),
    { stdout: 'current output', stderr: '' });
});

test('native timeout and output overflow both observe actual process close before rejection', async () => {
  for (const mode of ['timeout', 'overflow']) {
    let closed = false;
    const script = mode === 'timeout' ? 'setInterval(()=>{},1000)' : 'process.stdout.write("x".repeat(3*1024*1024));setInterval(()=>{},1000)';
    await assert.rejects(executeFixtureProbeCommand(process.execPath, ['--input-type=module', '-e', script], {
      timeout: mode === 'timeout' ? 150 : 10_000, execFileFn: (...args) => {
        const child = execFile(...args); child.once('close', () => { closed = true; }); return child;
      } }), error => mode === 'overflow' ? error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' : error.killed === true);
    assert.equal(closed, true);
  }
});

test('native cancellation waits for child close and preserves null', { timeout: 15_000 }, async t => {
  const ready = createFixtureGate(); const controller = new AbortController(); let closed = false;
  const task = executeFixtureProbeCommand(process.execPath, ['--input-type=module', '-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'], {
    signal: controller.signal, execFileFn: (...args) => {
      const child = execFile(...args); child.stdout.once('data', () => ready.release()); child.once('close', () => { closed = true; }); return child;
    } });
  const observed = task.catch(() => {});
  try {
    await waitForFixtureReady({ ready: ready.promise, operation: task, signal: t.signal }); controller.abort(null);
    await assert.rejects(task, error => error === null); assert.equal(closed, true);
  } finally { if (!controller.signal.aborted) controller.abort(null); await observed; }
});

test('native missing executable still reaches actual close before rejection', async () => {
  let closed = false;
  await assert.rejects(executeFixtureProbeCommand('harmoniarr-prerequisite-must-not-exist', [], { execFileFn: (...args) => {
    const child = execFile(...args); child.once('close', () => { closed = true; }); return child;
  } }), { code: 'ENOENT' });
  assert.equal(closed, true);
});
