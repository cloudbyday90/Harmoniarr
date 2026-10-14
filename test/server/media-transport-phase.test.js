/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaTransportObserver, disabledMediaTransportObserver } from '../../testing/integration/media-transport-phase-observer.js';
import { captureMediaTransportSnapshot, captureMediaTransportSummary, mediaTransportObservationLimit } from '../../testing/integration/media-transport-phase-policy.js';
import { closeMediaTransport } from '../../testing/integration/media-transport-release.js';
import { disabledWantedSeedObserver } from '../../testing/integration/wanted-seed-observer.js';
import { parseWantedWorkloadCommand } from '../../testing/integration/wanted-workload-command-policy.js';
import { runWantedWorkloadMeasurement } from '../../testing/integration/wanted-workload-runner.js';

const phase = (snapshot, name = 'command_exec') => snapshot.phases.find(row => row.phase === name);
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const summary = snapshot => ({ mediaProfile: 'sine', bindings: 2, pair: 0, backend: 'docker_cli', ownerCleanupSafe: true, snapshot });
const selected = diagnostics => parseWantedWorkloadCommand(['--output', 'local.json', '--source-noops', '--profiles', 'sine', '--bindings', '2', '--pairs', '1',
  '--media-execution', 'owned', '--media-diagnostics', diagnostics]);

test('transport counters expose held work and immutable snapshots, then settle returned command time', async () => {
  let tick = 20; const hold = gate(); const observer = createMediaTransportObserver({ now: () => tick }); const output = { stdout: 'private-output' };
  const work = observer.measure('command_exec', async () => { await hold.promise; return output; });
  const held = observer.snapshot(); assert.equal(phase(held).pending, 1); assert.equal(phase(held).completed, 0);
  assert.equal(captureMediaTransportSnapshot(held).phases.length, 12);
  assert.throws(() => { phase(held).pending = 10; }, TypeError);
  tick = 32; hold.release(); assert.equal(await work, output);
  const settled = phase(observer.snapshot()); assert.equal(settled.totalMs, 12); assert.equal(settled.timed, 1);
  assert.equal(settled.pending, 0); assert.equal(phase(held).pending, 1);
  assert.ok(!JSON.stringify(observer.snapshot()).includes('private-'));
});

for (const original of [new Error('private-original'), null]) {
  test(`clock failures retain original ${original === null ? 'null' : 'Error'} and unknown durations`, async () => {
    const observer = createMediaTransportObserver({ now: () => { throw new Error('private-clock'); } });
    await assert.rejects(observer.measure('command_exec', async () => { throw original; }), error => error === original);
    const row = phase(captureMediaTransportSnapshot(observer.snapshot()));
    assert.equal(row.failed, 1); assert.equal(row.pending, 0); assert.equal(row.untimed, 1); assert.equal(row.minMs, null);
  });
}

test('invalid elapsed clocks stay untimed and disabled observation does not change returned work', async () => {
  for (const times of [[10, 5], [0, NaN], [0, 86_400_001]]) {
    const observer = createMediaTransportObserver({ now: () => times.shift() });
    await observer.measure('command_exec', async () => 'current');
    assert.equal(phase(observer.snapshot()).untimed, 1); assert.equal(phase(observer.snapshot()).totalMs, 0);
  }
  const result = Promise.resolve('current');
  assert.equal(disabledMediaTransportObserver.measure('command_exec', () => result), result);
  assert.equal(disabledMediaTransportObserver.snapshot(), null);
});

test('fixed storage clips observation counts while every additional command still executes', async () => {
  let commands = 0; let ticks = 0;
  const observer = createMediaTransportObserver({ now: () => { ticks++; return 1; } });
  for (let i = 0; i <= mediaTransportObservationLimit; i++) await observer.measure('command_exec', () => { commands++; });
  const snapshot = captureMediaTransportSnapshot(observer.snapshot());
  assert.equal(commands, mediaTransportObservationLimit + 1); assert.equal(ticks, mediaTransportObservationLimit * 2);
  assert.equal(snapshot.phases.length, 12); assert.equal(snapshot.clipped, true);
  assert.equal(phase(snapshot).completed, mediaTransportObservationLimit);
});

test('public transport capture minimizes fields, reads changing getters once and refuses malformed aggregates', () => {
  let reads = 0; const snapshot = createMediaTransportObserver().snapshot();
  const raw = { ...summary(snapshot), path: 'private-path', argv: 'private-argv', stdout: 'private-output',
    get mediaProfile() { reads++; return reads === 1 ? 'sine' : 'private-profile'; } };
  const captured = captureMediaTransportSummary(raw); assert.equal(reads, 1); assert.equal(captured.mediaProfile, 'sine');
  assert.ok(!JSON.stringify(captured).includes('private-'));
  assert.equal(captureMediaTransportSnapshot({ ...snapshot, phases: [...snapshot.phases, snapshot.phases[0]] }), null);
  assert.equal(captureMediaTransportSnapshot({ ...snapshot, phases: snapshot.phases.map((row, i) => i ? row : { ...row, pending: 1 }) }), null);
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  assert.equal(captureMediaTransportSnapshot({ ...snapshot, phases: revoked.proxy }), null);
  assert.equal(captureMediaTransportSummary({ ...summary(snapshot), backend: 'local_tools' }), null);
  assert.equal(captureMediaTransportSummary({ ...summary(null), backend: 'local_tools', ownerCleanupSafe: null }).snapshot, null);
});

for (const original of [new Error('private-close'), null]) {
  test(`close drains a held failing summary sink and preserves original ${original === null ? 'null' : 'Error'}`, async () => {
    const hold = gate(); const ready = gate(); let settled = false; let seen;
    const transportObserver = createMediaTransportObserver();
    const work = closeMediaTransport({ executor: { close: async () => { throw original; }, canRemoveWorkspace: () => false },
      seedObserver: disabledWantedSeedObserver, transportObserver, enabled: true, location: { mediaProfile: 'sine', bindings: 2, pair: 0 },
      onRecord: async row => { seen = captureMediaTransportSummary(row); ready.release(); await hold.promise; throw new Error('private-sink'); },
    }).then(() => assert.fail('Expected original close failure'), error => { settled = true; assert.equal(error, original); });
    await ready.promise; assert.equal(settled, false); assert.equal(seen.ownerCleanupSafe, false);
    hold.release(); await work;
  });
}

test('workload report bounds minimized transport summaries and retains a partial original failure', async () => {
  const original = new Error('private-benchmark'); const snapshot = createMediaTransportObserver().snapshot();
  const result = await runWantedWorkloadMeasurement({ selection: selected('on'), measure: async ({ onMediaTransport }) => {
    for (let i = 0; i < 15; i++) onMediaTransport({ ...summary(snapshot), password: 'private-password' });
    onMediaTransport({ ...summary(snapshot), bindings: 100 }); throw original;
  } });
  assert.equal(result.error, original); assert.equal(result.report.completed, false);
  assert.equal(result.report.mediaTransports.length, 12); assert.equal(result.report.mediaTransportsClipped, true);
  assert.ok(!JSON.stringify(result.report).includes('private-'));
  const disabled = await runWantedWorkloadMeasurement({ selection: selected('off'), measure: async ({ onMediaTransport }) => {
    onMediaTransport(summary(snapshot)); throw original;
  } });
  assert.deepEqual(disabled.report.mediaTransports, []); assert.equal(disabled.report.mediaTransportsClipped, false);
});
