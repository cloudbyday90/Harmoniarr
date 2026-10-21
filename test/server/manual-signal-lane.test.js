/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { runManualSignalLane } from '../../testing/manual/manual-signal-lane.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

function fixture() {
  const entered = Promise.withResolvers(); const finish = Promise.withResolvers(); const calls = [];
  const id = 'a'.repeat(64); let container; let present = false;
  const state = { entered, finish, calls, foreign: false, failCreate: false, failRemove: false, failure: null,
    env: {}, output: { write() {} }, readDockerfile: () => readFile('Dockerfile', 'utf8'),
    async runDocker(args) {
      calls.push(args[0] === 'container' ? args[1] : args[0]);
      if (args[0] === 'context') return { stdout: 'unix:///var/run/docker.sock' };
      if (args[0] === 'pull') return { stdout: '' };
      if (args[0] === 'create') {
        const [label, nonce] = args[args.indexOf('--label') + 1].split('=');
        container = { Id: id, Name: `/${args[args.indexOf('--name') + 1]}`, Path: 'node',
          Config: { User: '1000:1000', Image: args.find(value => value.startsWith('node:')), Labels: { [label]: nonce } },
          HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
            Memory: 128 * 1024 * 1024, NanoCpus: 1e9, PidsLimit: 64, Privileged: false, PortBindings: {} },
          Mounts: ['package.json', 'testing/manual/manual-session-input.js', 'testing/manual/manual-session-runner.js',
            'testing/manual/manual-signal-child.js', 'test/signals/manual-session.test.js'].map(file => ({
            Destination: `/fixture/${file}`, Source: resolve(file), RW: false, Type: 'bind',
          })), State: { Running: false, OOMKilled: false, ExitCode: 0 } };
        present = true;
        if (state.failCreate) throw state.failure;
        return { stdout: id };
      }
      if (args[0] === 'start') { entered.resolve(); await finish.promise; return { stdout: '', stderr: '', exitCode: 0 }; }
      if (args[1] === 'inspect') return { stdout: JSON.stringify([{ ...container, Id: state.foreign ? 'b'.repeat(64) : id }]) };
      if (args[1] === 'ls') return { stdout: present ? id : '' };
      if (args[1] === 'rm') {
        assert.equal(args.at(-1), id);
        if (state.failRemove) throw state.failure;
        present = false; return { stdout: id };
      }
      assert.fail('Unexpected Docker command');
    },
  };
  return state;
}

async function rejectsOriginal(operation, expected) {
  let rejected = false;
  try { await operation; } catch (error) { rejected = true; assert.equal(error, expected); }
  assert.equal(rejected, true);
}

test('Linux signal lane refuses pre-aborted work and foreign acknowledged containers', async () => {
  for (const reason of [new Error('stop'), null]) {
    const state = fixture(); const control = new AbortController(); control.abort(reason);
    await rejectsOriginal(runManualSignalLane({ ...state, signal: control.signal }), reason);
    assert.deepEqual(state.calls, []);
  }
  const state = fixture(); state.foreign = true;
  await assert.rejects(runManualSignalLane(state), { code: 'ERR_ASSERTION' });
  assert.equal(state.calls.includes('rm'), false);
  assert.equal(state.calls.includes('start'), false);
});

test('Linux signal lane drains admitted commands before exact cleanup after cancellation', async t => {
  for (const reason of [new Error('stop'), null]) {
    const state = fixture(); const control = new AbortController();
    const operation = runManualSignalLane({ ...state, signal: control.signal });
    const outcome = rejectsOriginal(operation, reason);
    t.after(async () => { state.finish.resolve(); await outcome; });
    await waitForFixtureReady({ ready: state.entered.promise, operation });
    control.abort(reason); assert.equal(state.calls.includes('rm'), false);
    state.finish.resolve(); await outcome;
    assert.deepEqual(state.calls.slice(-4), ['ls', 'inspect', 'rm', 'ls']);
  }
});

test('Linux signal lane retains failed create/removal Error and null without certifying retirement', async () => {
  for (const failure of [new Error('Docker failed'), null]) {
    const create = fixture(); create.failCreate = true; create.failure = failure;
    await rejectsOriginal(runManualSignalLane(create), failure);
    assert.equal(create.calls.includes('rm'), true, 'uncertain create may have created the owned container');
    const remove = fixture(); remove.failRemove = true; remove.failure = failure; remove.finish.resolve();
    await rejectsOriginal(runManualSignalLane(remove), failure);
    assert.equal(remove.calls.at(-1), 'rm');
  }
});
