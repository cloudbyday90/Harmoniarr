/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

assert.equal(process.platform, 'linux', 'Run the explicit isolated Linux signal lane');
assert.equal(process.versions.node, '24.22.0');
assert.equal(process.getuid(), 1000);

async function scenario(t, { signal, phase, failure = 'none' }) {
  const child = spawn(process.execPath, ['testing/manual/manual-signal-child.js', phase, failure], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  let output = ''; let diagnostics = ''; let didClose = false;
  const messages = [];
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { diagnostics += value; });
  child.on('message', value => messages.push(value));
  const closed = new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('close', (code, receivedSignal) => { didClose = true; accept({ code, signal: receivedSignal }); });
  });
  closed.catch(() => {});
  async function message(type) {
    while (!messages.some(value => value.type === type)) {
      await Promise.race([once(child, 'message', { signal: t.signal }), closed.then(() => {
        throw new Error(`Signal child closed before ${type}: ${diagnostics}`);
      })]);
    }
    return messages.find(value => value.type === type);
  }
  try {
    assert.deepEqual(await message('checkpoint'), { type: 'checkpoint', platform: 'linux', node: '24.22.0' });
    assert.equal(child.kill(signal), true);
    assert.deepEqual(await message('cleanup'), { type: 'cleanup', stopped: true, commands: 0 });
    assert.equal(didClose, false);
    assert.equal(output.includes('fixture retired.'), false, 'retirement must await actual cleanup');
    child.stdin.write('hold\nstatus\n');
    child.send('probe');
    assert.deepEqual(await message('probe'), { type: 'probe', commands: 0, stopped: true });
    child.send('release');
    assert.deepEqual(await Promise.race([closed, once(t.signal, 'abort').then(() => { throw t.signal.reason; })]),
      { code: failure === 'none' ? 0 : 1, signal: null }, diagnostics);
    assert.equal(output.includes('Manual history fixture:'), phase === 'ready');
    assert.equal(output.includes('fixture retired.'), failure === 'none');
    assert.deepEqual(messages.filter(value => value.type === 'failure'), failure === 'none' ? [] : [{ type: 'failure', same: true }]);
  } finally {
    child.stdin.end();
    if (!didClose) {
      if (child.connected) child.send('release', () => {});
      const drained = await Promise.race([closed.then(() => true), delay(1000).then(() => false)]);
      if (!drained) child.kill('SIGKILL');
      await closed;
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  for (const phase of ['startup', 'ready']) {
    test(`actual Linux ${signal} during ${phase} drains cleanup and seals commands`, { timeout: 15_000 }, t => scenario(t, { signal, phase }));
  }
}
for (const failure of ['error', 'null']) {
  test(`actual Linux SIGTERM preserves cleanup ${failure}`, { timeout: 15_000 }, t => scenario(t, { signal: 'SIGTERM', phase: 'ready', failure }));
}
