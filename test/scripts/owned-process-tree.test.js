/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { terminateOwnedProcessTree } from '../../testing/integration/owned-process-tree.js';

function child(pid = 4321) {
  return Object.assign(new EventEmitter(), { pid, exitCode: null, signalCode: null });
}

function controlledTimers() {
  const pending = []; const waiting = [];
  return {
    setTimeoutFn(callback, milliseconds) {
      const timer = { callback, milliseconds, cancelled: false };
      if (waiting.length) waiting.shift()(timer); else pending.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) { timer.cancelled = true; },
    next() { return pending.length ? Promise.resolve(pending.shift()) : new Promise((resolve) => { waiting.push(resolve); }); },
    fire(timer) { assert.equal(timer.cancelled, false); timer.callback(); },
  };
}

test('POSIX termination targets only the actual owned group and observes close after TERM', async () => {
  const target = child(); const calls = [];
  target.reportedWorkerPids = [1, 99_999];
  const result = await terminateOwnedProcessTree({ child: target, platform: 'linux', killGroupFn(pid, signal) {
    calls.push({ pid, signal }); target.emit('close', null, 'SIGTERM');
  } });
  assert.deepEqual(calls, [{ pid: -4321, signal: 'SIGTERM' }]);
  assert.deepEqual(result, { quiescent: true, code: null });
});

test('PID one cannot become negative all-process signal authority', async () => {
  const target = child(1); const signals = [];
  const result = await terminateOwnedProcessTree({ child: target, platform: 'linux',
    killGroupFn(pid, signal) { signals.push({ pid, signal }); target.emit('close', null, signal); },
    setTimeoutFn(callback) { queueMicrotask(callback); return {}; }, clearTimeoutFn: () => {},
  });
  assert.deepEqual(signals, []);
  assert.deepEqual(result, { quiescent: false, code: 'fixture_process_tree_incomplete' });
});

test('POSIX escalation retains the initially captured runner identity when the object changes', async () => {
  const target = child(); const timers = controlledTimers(); const calls = [];
  const pending = terminateOwnedProcessTree({ child: target, platform: 'linux', ...timers,
    killGroupFn(pid, signal) {
      calls.push({ pid, signal });
      if (signal === 'SIGKILL') target.emit('close', null, 'SIGKILL');
    },
  });
  const grace = await timers.next();
  target.pid = 77_777; timers.fire(grace);
  assert.deepEqual(await pending, { quiescent: true, code: null });
  assert.deepEqual(calls, [{ pid: -4321, signal: 'SIGTERM' }, { pid: -4321, signal: 'SIGKILL' }]);
});

test('TERM and KILL without observed close report bounded incomplete termination', async () => {
  const target = child(); const timers = controlledTimers(); const calls = [];
  const pending = terminateOwnedProcessTree({ child: target, platform: 'linux', ...timers,
    killGroupFn: (pid, signal) => { calls.push({ pid, signal }); } });
  timers.fire(await timers.next());
  timers.fire(await timers.next());
  assert.deepEqual(await pending, { quiescent: false, code: 'fixture_process_tree_incomplete' });
  assert.equal(calls.length, 2);
  assert.equal(target.listenerCount('close'), 0);
});

test('Windows uses shell-free hidden taskkill for the actual spawned runner and waits for both closes', async () => {
  const target = child(); const killer = child(4322); const timers = controlledTimers(); const calls = [];
  let settled = false;
  const pending = terminateOwnedProcessTree({ child: target, platform: 'win32', ...timers,
    spawnFn(command, args, options) { calls.push({ command, args, options }); return killer; },
    killGroupFn: () => assert.fail('Windows attempted a process group signal'),
  }).then((result) => { settled = true; return result; });
  const firstTimer = await timers.next(); const secondTimer = await timers.next();
  killer.emit('close', 0, null);
  await Promise.resolve();
  assert.equal(settled, false);
  target.emit('close', null, 'SIGTERM');
  assert.deepEqual(await pending, { quiescent: true, code: null });
  assert.deepEqual(calls, [{ command: 'taskkill.exe', args: ['/PID', '4321', '/T', '/F'],
    options: { shell: false, windowsHide: true, stdio: 'ignore' } }]);
  assert.equal(firstTimer.cancelled, true); assert.equal(secondTimer.cancelled, true);
});

test('failed taskkill cannot certify tree termination even if runner close is observed', async () => {
  const target = child(); const killer = child(4322); const timers = controlledTimers();
  const pending = terminateOwnedProcessTree({ child: target, platform: 'win32', ...timers, spawnFn: () => killer });
  await timers.next(); await timers.next();
  killer.emit('error', new Error('Controlled taskkill failure'));
  killer.emit('close', 1, null); target.emit('close', null, 'SIGTERM');
  assert.deepEqual(await pending, { quiescent: false, code: 'fixture_process_tree_incomplete' });
});

test('a hung owned taskkill helper is reaped while incomplete runner termination stays explicit', async () => {
  const target = child(); const killer = child(4322); const timers = controlledTimers(); const helperSignals = [];
  killer.kill = (signal) => { helperSignals.push(signal); killer.emit('close', null, signal); };
  const pending = terminateOwnedProcessTree({ child: target, platform: 'win32', ...timers, spawnFn: () => killer });
  const commandTimer = await timers.next(); const runnerTimer = await timers.next();
  timers.fire(commandTimer); timers.fire(runnerTimer);
  assert.deepEqual(await pending, { quiescent: false, code: 'fixture_process_tree_incomplete' });
  assert.deepEqual(helperSignals, ['SIGKILL']);
  assert.equal(killer.listenerCount('close'), 0);
});

test('invalid or exited identities cannot become kill authority', async () => {
  for (const pid of [undefined, 0, -1, '4321', 1.2, 2_147_483_648]) {
    const target = child(pid); const timers = controlledTimers(); let killCalls = 0;
    // Passing undefined through the helper's default argument is explicit here.
    target.pid = pid;
    const pending = terminateOwnedProcessTree({ child: target, platform: 'win32', ...timers,
      spawnFn: () => { killCalls += 1; }, killGroupFn: () => { killCalls += 1; } });
    timers.fire(await timers.next());
    assert.deepEqual(await pending, { quiescent: false, code: 'fixture_process_tree_incomplete' });
    assert.equal(killCalls, 0);
  }
  const exited = child(); exited.exitCode = 0;
  const timers = controlledTimers();
  const pending = terminateOwnedProcessTree({ child: exited, platform: 'linux', ...timers,
    killGroupFn: () => assert.fail('Exited PID reused as kill authority') });
  await timers.next(); exited.emit('close', 0, null);
  assert.deepEqual(await pending, { quiescent: true, code: null });
});

test('a runner close captured before adapter entry causes no later PID termination', async () => {
  const result = await terminateOwnedProcessTree({ child: child(), closePromise: Promise.resolve({ exitCode: 0, signal: null }),
    spawnFn: () => assert.fail('Already closed runner spawned taskkill'),
    killGroupFn: () => assert.fail('Already closed runner group signalled') });
  assert.deepEqual(result, { quiescent: true, code: null });
});

test('group-signal errors remain observed and cannot be mistaken for completed termination', async () => {
  const target = child(); const timers = controlledTimers();
  const pending = terminateOwnedProcessTree({ child: target, platform: 'linux', ...timers,
    killGroupFn: () => { throw new Error('Controlled signal failure'); } });
  timers.fire(await timers.next());
  assert.deepEqual(await pending, { quiescent: false, code: 'fixture_process_tree_incomplete' });
});
