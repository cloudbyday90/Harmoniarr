/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertWantedRootProfileOptions, compareWantedRootProfilePair } from '../../testing/integration/wanted-root-profile-comparison.js';
import { parseWantedWorkloadCommand, wantedWorkloadExpectedKeys } from '../../testing/integration/wanted-workload-command-policy.js';
import { runWantedWorkloadMeasurement } from '../../testing/integration/wanted-workload-runner.js';
import { measureWantedRootLookups } from '../../testing/integration/wanted-root-lookup-benchmark.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const selection = (...args) => parseWantedWorkloadCommand(['--output', 'local.json', '--root-lookups', ...args]);
const sample = useCombinedRootRead => ({ mediaProfile: 'sine', receipts: 2, pair: 0, useCombinedRootRead });
const selected = () => selection('--profiles', 'sine', '--pairs', '1');
const sizes = [100, 200];
function comparisonPair() {
  const result = queryCount => ({ queryCount, projection: { wantedReleases: [], private: 'private-projection-canary' },
    diagnostics: { counters: { fingerprintCalls: 2, availableReceipts: 2, hashedBytes: 300 }, phases: { root_resolution: { calls: 2 } } } });
  return { legacy: result(12), joined: result(10) };
}
function dependencies() {
  const calls = []; const rows = [];
  return { calls, rows, options: {
    profiles: ['sine'], receiptCandidates: [1], pairs: 1,
    createRuntime: async () => ({ cleanup: async () => { calls.push('cleanup'); }, runIsolatedDatabase: async work => work() }),
    withApp: async options => { calls.push('app'); return options.withPostgresIntegrationRuntimeFn({ run: () => options.run({ workspaceDir: 'private-root' }) }); },
    exercise: async input => { calls.push('exercise'); assert.equal(input.receiptCandidates, 1); assert.equal(input.pairs, 1);
      for (const mode of [false, true]) await input.onSample(sample(mode)); },
    onSample: async row => { rows.push(row); }, onProgress: async () => { calls.push('progress'); },
  } };
}

test('explicit root default preserves all six scenarios and 48 unique counterbalanced variant keys', () => {
  const result = selection();
  assert.equal(result.kind, 'wanted_root_lookups'); assert.equal(result.plan.scope, 'full');
  assert.deepEqual(result.plan.receiptCounts, [2, 16, 48]); assert.equal(result.plan.pairs, 4);
  assert.equal(result.plan.expectedSamples, 48); assert.equal(wantedWorkloadExpectedKeys(result).size, 48);
  assert.deepEqual(result.options, { profiles: ['sine', 'noise'], receiptCandidates: [1, 8, 24], pairs: 4 });
  assert.deepEqual(result.variants, [false, true]); assert.equal(Object.isFrozen(result.options.receiptCandidates), true);
  assert.equal(selected().plan.scope, 'selected'); assert.equal(selected().plan.expectedSamples, 6);
  assert.equal(selection('--pairs', '2').plan.expectedSamples, 24);
});

test('root selection refuses mixed modes and foreign fixture/resource controls before allocation', () => {
  for (const args of [['--source-noops'], ['--bindings', '2'], ['--media-execution', 'owned'], ['--pairs', '3'],
    ['--pairs', '8'], ['--pairs', '04'], ['--profiles', 'noise,noise'], ['--seed-preview', 'worker']]) {
    assert.throws(() => selection(...args), TypeError);
  }
  for (const options of [{ profiles: new Array(1), receiptCandidates: [1], pairs: 1 },
    { profiles: ['sine'], receiptCandidates: [48], pairs: 1 }, { profiles: ['sine'], receiptCandidates: new Array(1), pairs: 1 }]) {
    assert.throws(() => assertWantedRootProfileOptions(options), TypeError);
  }
});

test('pair proof requires whole private projection and unchanged hash/root/query work', () => {
  assert.equal(compareWantedRootProfilePair(comparisonPair(), { receiptCandidates: 1, fileSizes: sizes }), undefined);
  for (const mutation of [row => { row.joined.projection.private = 'changed'; },
    row => { row.joined.projection.wantedReleases = ['changed']; }, row => { row.joined.queryCount++; },
    row => { row.joined.diagnostics.counters.fingerprintCalls--; }, row => { row.legacy.diagnostics.counters.hashedBytes--; },
    row => { row.joined.diagnostics.counters.availableReceipts--; }, row => { row.joined.diagnostics.phases.root_resolution.calls--; }]) {
    const rows = comparisonPair(); mutation(rows);
    assert.throws(() => compareWantedRootProfilePair(rows, { receiptCandidates: 1, fileSizes: sizes }));
  }
  assert.throws(() => compareWantedRootProfilePair(comparisonPair(), { receiptCandidates: 1, fileSizes: new Array(2) }));
});

test('full root report requires every selected sample and refuses missing, duplicate and foreign dimensions', async () => {
  const full = selection();
  const result = await runWantedWorkloadMeasurement({ selection: full, measure: async ({ onSample, onCheckpoint }) => {
    for (const mediaProfile of ['sine', 'noise']) for (const receipts of [2, 16, 48]) for (let pair = 0; pair < 4; pair++) {
      for (const useCombinedRootRead of [false, true]) onSample({ mediaProfile, receipts, pair, useCombinedRootRead });
    }
    onCheckpoint({ stage: 'sample', mediaProfile: 'noise', receipts: 48, pair: 3, mode: 'joined', password: 'private-canary' });
  } });
  assert.equal(result.report.completed, true); assert.equal(result.report.samples.length, 48);
  assert.deepEqual(result.report.lastCheckpoint, { stage: 'sample', mediaProfile: 'noise', bindings: null, receipts: 48, pair: 3, mode: 'joined' });
  assert.equal(JSON.stringify(result.report).includes('private-canary'), false);
  for (const rows of [[], [sample(false)], [sample(false), sample(false)], [sample(false), { ...sample(true), receipts: 96 }]]) {
    const refused = await runWantedWorkloadMeasurement({ selection: selected(), measure: async ({ onSample }) => rows.forEach(onSample) });
    assert.equal(refused.report.completed, false); assert.equal(refused.failed, true);
  }
});

test('benchmark uses existing isolated database owner, awaits progress and cleans the runtime once', async () => {
  const f = dependencies(); const rows = await measureWantedRootLookups(f.options);
  assert.deepEqual(f.calls, ['app', 'exercise', 'progress', 'cleanup']); assert.deepEqual(rows, f.rows); assert.equal(rows.length, 2);
});

test('invalid/pre-aborted benchmark admits no runtime and preserves original null', async () => {
  const f = dependencies(); f.options.createRuntime = () => assert.fail('No runtime admission');
  await assert.rejects(measureWantedRootLookups({ ...f.options, pairs: 8 }), TypeError);
  const controller = new AbortController(); controller.abort(null);
  await assert.rejects(measureWantedRootLookups({ ...f.options, signal: controller.signal }), error => error === null);
});

for (const primary of [new Error('Controlled scenario failure'), null]) {
  test(`scenario ${primary === null ? 'null' : 'Error'} survives failed cleanup without later profile admission`, async () => {
    const f = dependencies(); let cleaned = 0;
    f.options.profiles = ['sine', 'noise']; f.options.exercise = async () => { throw primary; };
    f.options.createRuntime = async () => ({ cleanup: async () => { cleaned++; throw new Error('Secondary cleanup'); } });
    f.options.withApp = async options => options.run({ workspaceDir: 'private-root' });
    await assert.rejects(measureWantedRootLookups(f.options), error => error === primary);
    assert.equal(cleaned, 1); assert.equal(f.calls.includes('progress'), false);
  });
}

test('cancellation after admitted startup still awaits owner return and cleanup before rejecting', async t => {
  const f = dependencies(); const entered = createFixtureGate(); const startup = createFixtureGate(); const cleanup = createFixtureGate();
  const controller = new AbortController(); const cleaning = createFixtureGate(); let settled = false;
  f.options.createRuntime = async () => { entered.release(); await startup.promise; return { cleanup: async () => { cleaning.release(); await cleanup.promise; } }; };
  const pending = measureWantedRootLookups({ ...f.options, signal: controller.signal });
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    controller.abort(null); assert.equal(settled, false); startup.release();
    await waitForFixtureReady({ ready: cleaning.promise, operation: pending, signal: t.signal });
    assert.equal(settled, false); assert.deepEqual(f.calls, []); cleanup.release();
    await assert.rejects(pending, error => error === null);
  } finally { startup.release(); cleanup.release(); await observed; }
});

test('final cleanup cancellation and checkpoint failure cannot return a successful benchmark', async () => {
  const f = dependencies(); const controller = new AbortController(); let cleaned = 0;
  f.options.createRuntime = async () => ({ cleanup: async () => { cleaned++; controller.abort(null); } });
  f.options.withApp = async options => options.run({ workspaceDir: 'private-root' });
  await assert.rejects(measureWantedRootLookups({ ...f.options, signal: controller.signal }), error => error === null);
  assert.equal(cleaned, 1);
  f.options.onCheckpoint = async ({ stage }) => { if (stage === 'server_cleanup') throw new Error('Controlled checkpoint failure'); };
  await assert.rejects(measureWantedRootLookups(f.options), { message: 'Controlled checkpoint failure' }); assert.equal(cleaned, 2);
});

test('held scenario cancellation retains the runtime until actual work return and closes later admission', async t => {
  const f = dependencies(); const entered = createFixtureGate(); const hold = createFixtureGate(); const controller = new AbortController();
  f.options.profiles = ['sine', 'noise'];
  f.options.exercise = async ({ signal }) => { entered.release(); await hold.promise; signal.throwIfAborted(); };
  const pending = measureWantedRootLookups({ ...f.options, signal: controller.signal }); pending.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    controller.abort(null); await Promise.resolve(); assert.deepEqual(f.calls, ['app']); hold.release();
    await assert.rejects(pending, error => error === null); assert.deepEqual(f.calls, ['app', 'cleanup']);
  } finally { hold.release(); await pending.catch(() => {}); }
});

test('held progress cancellation waits for its return and prevents the next scenario', async t => {
  const f = dependencies(); const entered = createFixtureGate(); const hold = createFixtureGate(); const controller = new AbortController();
  f.options.profiles = ['sine', 'noise']; f.options.onProgress = async () => { entered.release(); await hold.promise; };
  const pending = measureWantedRootLookups({ ...f.options, signal: controller.signal }); pending.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    controller.abort(null); await Promise.resolve(); assert.deepEqual(f.calls, ['app', 'exercise']); hold.release();
    await assert.rejects(pending, error => error === null); assert.deepEqual(f.calls, ['app', 'exercise', 'cleanup']);
  } finally { hold.release(); await pending.catch(() => {}); }
});

test('reviewed dimension snapshot cannot be changed by a caller during startup', async () => {
  const f = dependencies();
  f.options.onCheckpoint = async ({ stage }) => {
    if (stage === 'server_start') { f.options.profiles.push('noise'); f.options.receiptCandidates.push(24); }
  };
  assert.equal((await measureWantedRootLookups(f.options)).length, 2);
  assert.deepEqual(f.calls, ['app', 'exercise', 'progress', 'cleanup']);
});
