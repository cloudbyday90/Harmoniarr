/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createManualPostgresRuntime } from '../../testing/manual/manual-postgres-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

function fixture() {
  const calls = []; const entered = Promise.withResolvers(); const finish = Promise.withResolvers();
  let created = false; let name; let nonce;
  const id = 'a'.repeat(64);
  const state = {
    calls, entered, finish, env: {}, removeFailure: undefined, failRemoval: false,
    async runDocker(args) {
      calls.push(args[0] === 'container' ? `${args[0]}-${args[1]}` : args[0]);
      if (args[0] === 'context') return { stdout: 'unix:///var/run/docker.sock' };
      if (args[0] === 'version') return { stdout: '29.8.2' };
      if (args[0] === 'run') {
        name = args[args.indexOf('--name') + 1]; nonce = args[args.indexOf('--label') + 1].split('=')[1];
        assert.equal(args[args.indexOf('--publish') + 1], '127.0.0.1::5432');
        created = true; entered.resolve(); await finish.promise; return { stdout: id };
      }
      if (args[1] === 'ls') return { stdout: created ? id : '' };
      if (args[1] === 'inspect') return { stdout: JSON.stringify([{ Id: id, Name: `/${name}`, Config: { Labels: { 'io.harmoniarr.manual-history': nonce } } }]) };
      if (args[1] === 'rm') {
        assert.equal(args.at(-1), id);
        if (state.failRemoval) throw state.removeFailure;
        created = false; return { stdout: id };
      }
      assert.fail('Unexpected Docker call');
    },
  };
  return state;
}

async function rejectsOriginal(pending, reason) {
  let rejected = false;
  try { await pending; } catch (error) { rejected = true; assert.equal(error, reason); }
  assert.equal(rejected, true);
}

test('pre-aborted manual database startup launches no Docker command, including Error/null reasons', async () => {
  for (const reason of [new Error('stop'), null]) {
    const control = new AbortController(); control.abort(reason); const docker = fixture();
    await rejectsOriginal(createManualPostgresRuntime({ config: resolveIntegrationTestRuntimeConfig(), signal: control.signal }, docker), reason);
    assert.deepEqual(docker.calls, []);
  }
});

test('stop during Docker run waits for the actual command before exact owned removal and refusal', async t => {
  for (const reason of [new Error('stop'), null]) {
    const control = new AbortController(); const docker = fixture(); let settled = false;
    const pending = createManualPostgresRuntime({ config: resolveIntegrationTestRuntimeConfig(), signal: control.signal }, docker);
    const outcome = rejectsOriginal(pending, reason).then(() => { settled = true; });
    t.after(async () => { docker.finish.resolve(); await outcome; });
    await waitForFixtureReady({ ready: docker.entered.promise, operation: pending }); control.abort(reason);
    assert.equal(settled, false); assert.equal(docker.calls.includes('container-rm'), false);
    docker.finish.resolve(); await outcome;
    assert.deepEqual(docker.calls, ['context', 'version', 'run', 'container-inspect', 'container-ls', 'container-inspect', 'container-rm', 'container-ls']);
  }
});

test('a failed removal after expected stop remains a failure instead of a successful cancellation', async t => {
  for (const removal of [new Error('remove'), null]) {
    const control = new AbortController(); const docker = fixture(); docker.failRemoval = true; docker.removeFailure = removal;
    const pending = createManualPostgresRuntime({ config: resolveIntegrationTestRuntimeConfig(), signal: control.signal }, docker);
    const outcome = rejectsOriginal(pending, removal); t.after(async () => { docker.finish.resolve(); await outcome; });
    await waitForFixtureReady({ ready: docker.entered.promise, operation: pending }); control.abort(new Error('expected stop')); docker.finish.resolve(); await outcome;
    assert.equal(docker.calls.at(-1), 'container-rm');
  }
});
