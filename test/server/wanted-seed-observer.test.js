/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { captureWantedSeedRecord, createWantedSeedObserver } from '../../testing/integration/wanted-seed-observer.js';
import { observeWantedSeedMedia } from '../../testing/integration/wanted-seed-media-observer.js';
import { parseWantedWorkloadCommand } from '../../testing/integration/wanted-workload-command-policy.js';
import { runWantedWorkloadMeasurement } from '../../testing/integration/wanted-workload-runner.js';

test('nested seed operations retain their own context and do not sum overlapping durations', async () => {
  const rows = []; let tick = 0;
  const observer = createWantedSeedObserver({ onRecord: row => rows.push(row), now: () => tick });
  const value = await observer.measure('seed_total', null, async () => {
    tick = 5; await observer.measure('consent', 2, async () => { tick = 12; }); tick = 20; return 42;
  });
  assert.equal(value, 42);
  assert.deepEqual(rows.map(row => [row.phase, row.event, row.spanId, row.parentSpanId, row.context]),
    [['seed_total', 'start', 1, null, null], ['consent', 'start', 2, 1, 2], ['consent', 'settled', 2, 1, 2], ['seed_total', 'settled', 1, null, null]]);
  assert.equal(rows[2].durationMs, 7); assert.equal(rows[3].durationMs, 20);
});

for (const original of [new Error('private-primary'), null]) {
  test(`seed observer drains a held failing sink and retains original ${original === null ? 'null' : 'Error'}`, async () => {
    let release; const gate = new Promise(resolve => { release = resolve; }); let entered;
    const ready = new Promise(resolve => { entered = resolve; }); let settled = false;
    const observer = createWantedSeedObserver({ now: () => { throw new Error('private-clock'); },
      onRecord: async row => { if (row.event === 'settled') { entered(); await gate; throw new Error('private-sink'); } } });
    const work = observer.measure('delivery_apply', 1, async () => { throw original; }).then(
      () => assert.fail('Expected original failure'), error => { settled = true; assert.equal(error, original); });
    await ready;
    try { assert.equal(settled, false); } finally { release(); }
    await work; assert.equal(settled, true);
  });
}

test('media wrapper preserves argv, options, receiver and result while inspections follow the caller context', async () => {
  const rows = []; const observer = createWantedSeedObserver({ onRecord: row => rows.push(row) });
  const args = ['private-argument']; const options = { readonly: true }; const output = { stdout: 'private-output' };
  const media = { async mediaCommand(binary, receivedArgs, receivedOptions) {
    assert.equal(this, media); assert.equal(binary, 'ffprobe'); assert.equal(receivedArgs, args); assert.equal(receivedOptions, options); return output;
  } };
  const observed = observeWantedSeedMedia(media, { observer, context: 1 });
  await observer.measure('delivery_apply', 3, async () => { assert.equal(await observed.mediaCommand('ffprobe', args, options), output); });
  assert.equal(rows[1].phase, 'media_inspect'); assert.equal(rows[1].context, 3);
  assert.ok(!JSON.stringify(rows).includes('private-'));
});

test('seed records exclude private/changing fields and invalid phases', () => {
  let reads = 0;
  const row = { phase: 'consent', event: 'settled', spanId: 1, durationMs: 2, outcome: 'completed',
    get context() { reads++; return reads === 1 ? 2 : 'private-context'; }, path: 'private-path' };
  assert.equal(captureWantedSeedRecord(row).context, 2); assert.equal(reads, 1);
  assert.ok(!JSON.stringify(captureWantedSeedRecord({ ...row })).includes('private-'));
  assert.equal(captureWantedSeedRecord({ ...row, phase: 'private-phase' }), null);
});

test('workload output keeps a bounded seed tail, explicit clipping and private original failure', async () => {
  const selection = parseWantedWorkloadCommand(['--output', 'local.json', '--source-noops', '--profiles', 'sine', '--bindings', '2', '--pairs', '1']);
  const original = new Error('private-failure'); let reads = 0;
  const result = await runWantedWorkloadMeasurement({ selection, measure: async ({ onSeedRecord }) => {
    for (let i = 1; i <= 260; i++) onSeedRecord({ phase: 'media_inspect', event: 'settled', spanId: i,
      outcome: 'completed', durationMs: 1, mediaProfile: 'noise', bindings: 8, pair: 0, path: 'private-path' });
    onSeedRecord({ phase: 'consent', event: 'settled', spanId: 261, outcome: 'failed', durationMs: 1,
      get mediaProfile() { reads++; return reads === 1 ? 'noise' : 'private-profile'; } });
    throw original;
  } });
  assert.equal(result.error, original); assert.equal(result.report.completed, false); assert.equal(result.report.seedPhasesClipped, true);
  assert.equal(result.report.seedPhases.length, 256); assert.equal(reads, 1);
  assert.equal(result.report.seedPhases.at(-1).phase, 'consent'); assert.ok(!JSON.stringify(result.report).includes('private-'));
});
