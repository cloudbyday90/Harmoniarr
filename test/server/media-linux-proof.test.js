/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMediaLinuxProofRunner } from '../../testing/integration/media-linux-proof-runner.js';
import { assertMediaLinuxProofOwner, mediaLinuxProofLabel, mediaLinuxProofSocket } from '../../testing/integration/media-linux-proof-policy.js';

const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
function control(root, options = {}) {
  const calls = []; const id = 'a'.repeat(64); const image = `sha256:${'b'.repeat(64)}`; let token; let running = false;
  const state = () => ({ Id: options.changed ? 'c'.repeat(64) : id, Image: image,
    Config: { Labels: { [mediaLinuxProofLabel]: token }, Entrypoint: ['node'], Cmd: ['/proof/entry.js'], User: '0:0', Healthcheck: { Test: ['NONE'] } },
    HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, Privileged: false, RestartPolicy: { Name: 'no' },
      CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Mounts: [[root, '/proof'], [mediaLinuxProofSocket, mediaLinuxProofSocket]]
        .map(([Source, Target]) => ({ Source, Target, Type: 'bind', ReadOnly: true, BindOptions: { NonRecursive: true } })) },
    Mounts: [{ Destination: '/proof', RW: false }, { Destination: mediaLinuxProofSocket, RW: false }],
    State: { Running: running, ExitCode: 0 }, ExecIDs: null });
  const invoke = async args => {
    calls.push(args);
    if (args[0] === 'create') { token = args[args.indexOf('--label') + 1].split('=')[1]; return { stdout: options.partial ? 'partial' : id }; }
    if (args[0] === 'inspect') return { stdout: JSON.stringify([state()]) };
    if (args[0] === 'start') {
      running = true; options.entered?.release(); if (options.hold) await options.hold.promise;
      if (Object.hasOwn(options, 'failure')) throw options.failure;
      running = false; return { stdout: '{"closed":true}' };
    }
    if (args[0] === 'stop') { running = false; return { stdout: id }; }
    if (args[0] === 'rm') { assert.equal(running, false); return { stdout: id }; }
    assert.fail('Unreviewed proof command');
  };
  return { invoke, calls, id, image, state, expected: () => ({ id, image, root, token }) };
}
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-proof-policy-'));
  try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('proof close seals admission and drains held attached start before acknowledged removal', () => fixture(async root => {
  const entered = gate(); const hold = gate(); const fake = control(root, { entered, hold });
  const runner = createMediaLinuxProofRunner({ root, ...fake }); const work = runner.run(); await entered.promise;
  await assert.rejects(runner.run()); const closing = runner.close(); assert.equal(runner.close(), closing);
  await assert.rejects(runner.run()); assert.equal(fake.calls.some(args => args[0] === 'rm'), false);
  hold.release(); assert.equal((await work).stdout, '{"closed":true}'); await closing;
  assert.equal(fake.calls.filter(args => args[0] === 'rm').length, 1);
  for (const args of fake.calls.filter(row => ['start', 'inspect', 'rm'].includes(row[0]))) assert.ok(args.includes(fake.id));
}));

for (const failure of [new Error('original-attached-timeout'), null]) {
  test(`attached start preserves ${failure === null ? 'null' : 'Error'} and whole runner is stopped before removal`, () => fixture(async root => {
    const fake = control(root, { failure }); const runner = createMediaLinuxProofRunner({ root, ...fake });
    await assert.rejects(runner.run(), error => error === failure); await runner.close();
    const actions = fake.calls.map(args => args[0]); assert.ok(actions.indexOf('stop') < actions.indexOf('rm'));
    assert.equal(fake.state().State.Running, false);
  }));
}

test('partial acknowledgements and changed runner identity never permit guessed stop or removal', () => fixture(async root => {
  for (const options of [{ partial: true }, { changed: true }]) {
    const fake = control(root, options); const runner = createMediaLinuxProofRunner({ root, ...fake });
    await assert.rejects(runner.run()); await assert.rejects(runner.close());
    assert.equal(fake.calls.some(args => ['stop', 'rm'].includes(args[0])), false);
  }
}));

test('proof policy refuses extra/writable/socket-redirection mounts and changed isolation', () => fixture(async root => {
  const fake = control(root); const runner = createMediaLinuxProofRunner({ root, ...fake }); await runner.run();
  assert.doesNotThrow(() => assertMediaLinuxProofOwner(fake.state(), fake.expected()));
  for (const mutate of [state => { state.Config.Labels[mediaLinuxProofLabel] = 'other'; },
    state => { state.HostConfig.NetworkMode = 'bridge'; }, state => { state.HostConfig.Privileged = true; },
    state => { state.Config.User = '1000:1000'; }, state => { state.HostConfig.Mounts[1].Source = '/another.sock'; },
    state => { state.Mounts[1].RW = true; }, state => { state.HostConfig.Mounts.push(state.HostConfig.Mounts[0]); },
    state => { state.HostConfig.Mounts[0].BindOptions.NonRecursive = false; }]) {
    const state = fake.state(); mutate(state); assert.throws(() => assertMediaLinuxProofOwner(state, fake.expected()));
  }
  await runner.close();
}));
