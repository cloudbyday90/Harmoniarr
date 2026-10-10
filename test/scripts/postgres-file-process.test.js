/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { runPostgresTestFile } from '../../testing/integration/postgres-file-process.js';

function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 4321, exitCode: null, signalCode: null,
    stdout: new PassThrough(), stderr: new PassThrough() });
  const calls = []; const output = { stdout: '', stderr: '' };
  const input = { file: 'test/integration/library-scan-catalogue.test.js', cwd: 'controlled-workspace',
    env: { PGHOST: 'private-host-canary', PGPASSWORD: 'private-password-canary', NODE_TEST_CONTEXT: 'child-v8', OTHER: 'retained' },
    stdout: new Writable({ write(chunk, encoding, callback) { output.stdout += chunk.toString(); callback(); } }),
    stderr: new Writable({ write(chunk, encoding, callback) { output.stderr += chunk.toString(); callback(); } }),
    spawnFn(command, args, options) { calls.push({ command, args, options }); return child; },
    terminateFn: async ({ child: target }) => {
      assert.equal(target, child); finish(null, 'SIGTERM'); return { quiescent: true, code: null };
    },
  };
  function finish(exitCode = 0, signal = null) {
    child.exitCode = exitCode; child.signalCode = signal;
    child.stdout.end(); child.stderr.end(); child.emit('close', exitCode, signal);
  }
  return { child, calls, output, input, finish };
}

test('file process uses a pinned native serial command, explicit copied environment and separate complete output', async () => {
  const f = fixture(); const pending = runPostgresTestFile(f.input);
  f.child.stdout.write('native spec progress\n'); f.child.stderr.write('approved early failure\n');
  f.finish(1);
  const result = await pending;
  assert.equal(result.exitCode, 1); assert.equal(result.signal, null);
  assert.equal(Number.isFinite(result.durationMs) && result.durationMs >= 0, true);
  assert.deepEqual(f.output, { stdout: 'native spec progress\n', stderr: 'approved early failure\n' });
  assert.equal(f.calls[0].command, process.execPath);
  assert.deepEqual(f.calls[0].args, ['--test', '--test-concurrency=1', '--test-reporter=spec',
    '--test-reporter=./testing/reporters/early-failure-reporter.js', '--test-reporter-destination=stdout',
    '--test-reporter-destination=stderr', f.input.file]);
  assert.equal(f.calls[0].options.shell, false); assert.equal(f.calls[0].options.windowsHide, true);
  assert.equal(f.calls[0].options.detached, process.platform !== 'win32');
  assert.equal(Object.hasOwn(f.calls[0].options.env, 'NODE_TEST_CONTEXT'), false);
  assert.notEqual(f.calls[0].options.env, f.input.env);
  assert.equal(f.input.env.NODE_TEST_CONTEXT, 'child-v8');
  assert.equal(f.calls[0].options.env.OTHER, 'retained');
  assert.equal(f.calls[0].options.env.PGPASSWORD, f.input.env.PGPASSWORD);
});

test('exit and runner close cannot bypass asynchronous output write completion', async (t) => {
  const f = fixture(); const writeEntered = createFixtureGate(); let completeWrite; let settled = false;
  f.input.stdout = new Writable({ write(chunk, encoding, callback) { completeWrite = callback; writeEntered.release(); } });
  const pending = runPostgresTestFile(f.input).then((result) => { settled = true; return result; });
  try {
    f.child.stdout.write('held output');
    await waitForFixtureReady({ ready: writeEntered.promise, operation: pending, signal: t.signal });
    f.child.emit('exit', 0, null); await Promise.resolve(); assert.equal(settled, false);
    f.finish(); await Promise.resolve(); assert.equal(settled, false);
    completeWrite(); completeWrite = null; assert.equal((await pending).exitCode, 0);
  } finally { completeWrite?.(); f.finish(); await pending; }
});

test('pre-aborted Error and null reasons launch no owned process', async () => {
  for (const reason of [new Error('Controlled cancellation'), null]) {
    const f = fixture(); const controller = new AbortController(); controller.abort(reason);
    await assert.rejects(runPostgresTestFile({ ...f.input, signal: controller.signal }), (error) => error === reason);
    assert.equal(f.calls.length, 0);
  }
});

test('cancellation closes admission before termination, then drains actual close and output', async (t) => {
  const f = fixture(); const controller = new AbortController(); const reason = new Error('Controlled cancellation');
  const admissionClosed = createFixtureGate(); const allowTermination = createFixtureGate(); const order = []; const observations = [];
  f.input.onCancel = async () => { order.push('admission closed'); admissionClosed.release(); await allowTermination.promise; };
  f.input.terminateFn = async ({ child: target }) => {
    assert.equal(target, f.child); order.push('terminate'); f.finish(null, 'SIGTERM');
    return { quiescent: true, code: null };
  };
  const pending = runPostgresTestFile({ ...f.input, signal: controller.signal, onTermination: (record) => observations.push(record) });
  pending.catch(() => {}); controller.abort(reason);
  try {
    await waitForFixtureReady({ ready: admissionClosed.promise, operation: pending, signal: t.signal });
    assert.deepEqual(order, ['admission closed']);
    allowTermination.release();
    await assert.rejects(pending, (error) => error === reason);
    assert.deepEqual(order, ['admission closed', 'terminate']);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].quiescent, true); assert.equal(observations[0].code, null);
    assert.equal(typeof observations[0].outputDrained, 'boolean');
  } finally { allowTermination.release(); f.finish(); await pending.catch(() => {}); }
});

test('successful cancelled process close releases a held output consumer without claiming its output was drained', async (t) => {
  const f = fixture(); const controller = new AbortController(); const primary = new Error('Controlled cancellation with held output');
  const writeEntered = createFixtureGate(); const observedTermination = createFixtureGate();
  let completeWrite; let callbackReleased = false; let observation;
  f.input.stdout = new Writable({ write(chunk, encoding, callback) {
    completeWrite = () => { callbackReleased = true; callback(); };
    writeEntered.release();
  } });
  const pending = runPostgresTestFile({ ...f.input, signal: controller.signal, onTermination(result) {
    observation = result; observedTermination.release();
  } });
  pending.catch(() => {});
  try {
    f.child.stdout.write('held cancellation output');
    await waitForFixtureReady({ ready: writeEntered.promise, operation: pending, signal: t.signal });
    controller.abort(primary);
    await observedTermination.promise;
    assert.equal(observation.quiescent, true);
    assert.equal(observation.outputDrained, false);
    await assert.rejects(pending, (error) => error === primary);
    assert.equal(callbackReleased, false);
  } finally {
    completeWrite?.();
    f.finish(); await pending.catch(() => {});
  }
});

test('incomplete termination remains explicit out of band while preserving exact abort null', async () => {
  const f = fixture(); const controller = new AbortController(); const observations = [];
  f.input.terminateFn = async () => ({ quiescent: false, code: 'fixture_process_tree_incomplete' });
  const pending = runPostgresTestFile({ ...f.input, signal: controller.signal,
    onTermination: (record) => observations.push(record) });
  controller.abort(null);
  await assert.rejects(pending, (error) => error === null);
  assert.deepEqual(observations, [{ quiescent: false, code: 'fixture_process_tree_incomplete', outputDrained: false }]);
  assert.equal(f.child.exitCode, null);
  f.finish();
});

test('throwing termination cleanup preserves the original cancellation and reports incomplete quiescence', async () => {
  const f = fixture(); const controller = new AbortController(); const reason = new Error('Controlled primary cancellation');
  const observations = [];
  f.input.onCancel = () => { throw new Error('Controlled secondary admission error'); };
  f.input.terminateFn = async () => { throw new Error('Controlled secondary termination error'); };
  const pending = runPostgresTestFile({ ...f.input, signal: controller.signal,
    onTermination: (record) => observations.push(record) });
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(observations[0].quiescent, false);
  f.finish();
});

test('synchronous spawn failure preserves its identity after admission cleanup without any PID termination', async () => {
  const f = fixture(); const primary = new Error('Controlled spawn failure'); const order = [];
  f.input.spawnFn = () => { throw primary; };
  f.input.onCancel = () => { order.push('admission closed'); throw new Error('Secondary cleanup failure'); };
  f.input.terminateFn = () => assert.fail('Failed spawn attempted PID termination');
  f.input.onTermination = (result) => order.push(result.quiescent);
  await assert.rejects(runPostgresTestFile(f.input), (error) => error === primary);
  assert.deepEqual(order, ['admission closed', true]);
});

test('asynchronous spawn errors remain observed until the owned child close', async () => {
  const f = fixture(); const primary = new Error('Controlled asynchronous spawn failure');
  const pending = runPostgresTestFile(f.input);
  f.child.emit('error', primary);
  await assert.rejects(pending, (error) => error === primary);
  assert.equal(f.child.listenerCount('error'), 0);
});

test('destination write failure and readable failure each preserve primary identity after owned termination', async () => {
  for (const failure of ['destination', 'source']) {
    const f = fixture(); const primary = new Error(`Controlled ${failure} failure`); const order = [];
    f.input.onCancel = () => { order.push('admission closed'); };
    if (failure === 'destination') f.input.stdout = new Writable({ write(chunk, encoding, callback) { callback(primary); } });
    const pending = runPostgresTestFile(f.input);
    if (failure === 'destination') f.child.stdout.write('controlled output'); else f.child.stdout.destroy(primary);
    await assert.rejects(pending, (error) => error === primary);
    assert.deepEqual(order, ['admission closed']);
    assert.equal(f.child.signalCode, 'SIGTERM');
  }
});

test('invalid direct service input refuses launch before interacting with any child', async () => {
  for (const file of [undefined, null, '', '   ', '--eval', 'test\0.js']) {
    const f = fixture();
    await assert.rejects(runPostgresTestFile({ ...f.input, file }), TypeError);
    assert.equal(f.calls.length, 0);
  }
});
