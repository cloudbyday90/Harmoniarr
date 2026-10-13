/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseWantedWorkloadCommand } from '../../testing/integration/wanted-workload-command-policy.js';
import { runWantedWorkloadMeasurement } from '../../testing/integration/wanted-workload-runner.js';

const base = ['--output', 'local.json'];
const selected = () => parseWantedWorkloadCommand([...base, '--source-noops', '--profiles', 'sine', '--bindings', '2', '--pairs', '1']);
const sample = mode => ({ mediaProfile: 'sine', bindings: 2, pair: 0, sourceTransitionMode: mode });

test('legacy workload commands keep full dimensions and original comparator selection', () => {
  for (const mode of ['', '--source-noops', '--distinct-bindings', '--bounded-roots', '--receipt-groups', '--root-costs']) {
    const result = parseWantedWorkloadCommand([...base, ...(mode ? [mode] : [])]);
    assert.equal(result.plan.scope, 'full'); assert.equal(result.plan.expectedSamples, 24);
    assert.deepEqual(result.plan.profiles, ['sine', 'noise']); assert.equal(result.plan.pairs, 2);
    assert.deepEqual(result.distinct ? result.plan.bindingCounts : result.plan.receiptCounts, result.distinct ? [2, 4, 8] : [16, 48, 96]);
    assert.equal(result.options.sourceNoopComparison === true, mode === '--source-noops');
  }
});

test('explicit workload selection records reduced scope and forwards only reviewed options', () => {
  const result = selected();
  assert.deepEqual(result.plan, { scope: 'selected', profiles: ['sine'], bindingCounts: [2], pairs: 1, expectedSamples: 2 });
  assert.deepEqual(result.options, { profiles: ['sine'], bindingCounts: [2], pairs: 1, sourceNoopComparison: true });
  assert.throws(() => result.plan.profiles.push('noise'), TypeError);
  assert.throws(() => { result.options.pairs = 2; }, TypeError);
});

test('ambiguous, duplicate, unsupported and incomplete commands refuse before measurement', () => {
  for (const tail of [['--source-noops', '--source-noops'], ['--source-noops', '--distinct-bindings'],
    ['--profiles', 'sine,sine'], ['--profiles', 'sine,'], ['--profiles', 'private'],
    ['--bindings', '2'], ['--source-noops', '--bindings', '16'], ['--source-noops', '--bindings', '2,2'],
    ['--pairs', '3'], ['--pairs', '01'], ['--pairs'], ['--pairs', '1', '--pairs', '2'],
    ['--output', 'other.json'], ['--unknown'], ['--profiles', '--pairs', '1']]) {
    assert.throws(() => parseWantedWorkloadCommand([...base, ...tail]), TypeError);
  }
  for (const args of [[], ['--output', ' '], ['--output'], new Array(2), [null]]) {
    assert.throws(() => parseWantedWorkloadCommand(args), TypeError);
  }
});

test('runner waits for returned benchmark cleanup before reporting complete selected samples', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  let entered; const ready = new Promise(resolve => { entered = resolve; }); let settled = false;
  const controller = new AbortController(); const progress = []; let tick = 10;
  const work = runWantedWorkloadMeasurement({ selection: selected(), signal: controller.signal, now: () => tick,
    onProgress: row => progress.push(row), measure: async input => {
      assert.equal(input.signal, controller.signal); assert.deepEqual(input.bindingCounts, [2]);
      input.onSample(sample('compatibility')); input.onSample(sample('locked-noop'));
      await input.onProgress({ completedSamples: 2 }); entered(); await gate; tick = 35;
    } }).then(result => { settled = true; return result; });
  await ready;
  try { assert.equal(settled, false); } finally { release(); }
  const result = await work;
  assert.equal(result.failed, false); assert.equal(result.report.completed, true); assert.equal(result.report.measurementMs, 25);
  assert.equal(result.report.failure, null); assert.equal(result.report.samples.length, 2);
  assert.deepEqual(progress, [{ completedSamples: 2 }]);
});

for (const original of [new Error('private-message-canary'), null]) {
  test(`runner retains partial samples and original ${original === null ? 'null' : 'Error'} while minimizing failure output`, async () => {
    if (original) Object.assign(original, { actual: 'private-actual-canary', expected: 'private-expected-canary',
      cause: { password: 'private-cause-canary' }, code: 'private-code-canary' });
    const result = await runWantedWorkloadMeasurement({ selection: selected(), measure: async ({ onSample }) => {
      onSample(sample('compatibility')); throw original;
    } });
    assert.equal(result.failed, true); assert.equal(result.error, original); assert.equal(result.report.completed, false);
    assert.deepEqual(result.report.samples, [sample('compatibility')]);
    assert.equal(result.report.failure.code, null);
    assert.ok(!JSON.stringify(result.report).includes('private-'));
    if (original) assert.ok(result.report.failure.frames.some(frame => frame.file === 'test/scripts/wanted-workload-command.test.js'));
  });
}

test('runner refuses early return, repeated variants and foreign dimensions rather than reporting completion', async () => {
  for (const rows of [[], [sample('compatibility')], [sample('compatibility'), sample('compatibility')],
    [sample('compatibility'), { ...sample('locked-noop'), bindings: 4 }]]) {
    const result = await runWantedWorkloadMeasurement({ selection: selected(), measure: async ({ onSample }) => rows.forEach(onSample) });
    assert.equal(result.failed, true); assert.equal(result.report.completed, false);
    assert.equal(result.report.failure.category, 'assertion'); assert.equal(result.report.failure.code, 'ERR_ASSERTION');
  }
});

test('pre-cancellation and cancellation during returned cleanup retain null and cannot report completion', async () => {
  for (const preCancelled of [true, false]) {
    const controller = new AbortController(); let admitted = false;
    if (preCancelled) controller.abort(null);
    const result = await runWantedWorkloadMeasurement({ selection: selected(), signal: controller.signal,
      measure: async ({ onSample }) => {
        admitted = true; onSample(sample('compatibility')); onSample(sample('locked-noop')); controller.abort(null);
      } });
    assert.equal(admitted, !preCancelled); assert.equal(result.failed, true); assert.equal(result.error, null);
    assert.equal(result.report.completed, false); assert.equal(result.report.samples.length, preCancelled ? 0 : 2);
  }
});

test('native timeout classification retains only the approved phase, dimensions and error class', async () => {
  const original = new DOMException('private-timeout-canary', 'TimeoutError');
  const result = await runWantedWorkloadMeasurement({ selection: selected(), measure: async ({ onCheckpoint }) => {
    onCheckpoint({ stage: 'sample', mediaProfile: 'noise', bindings: 8, pair: 1, mode: 'compatibility', password: 'private-checkpoint-canary' });
    onCheckpoint({ stage: 'private-stage-canary' }); throw original;
  } });
  assert.equal(result.error, original); assert.equal(result.report.failure.category, 'timeout');
  assert.equal(result.report.failure.errorClass, 'TimeoutError');
  assert.deepEqual(result.report.lastCheckpoint, { stage: 'sample', mediaProfile: 'noise', bindings: 8, pair: 1, mode: 'compatibility' });
  assert.ok(!JSON.stringify(result.report).includes('private-'));
});

test('CLI invalid selection exits without executing a fixture or exposing the supplied argument', async () => {
  await assert.rejects(promisify(execFile)(process.execPath,
    ['scripts/measure-wanted-guarded-workload.js', ...base, '--profiles', 'private-argument-canary'],
    { windowsHide: true, timeout: 10_000 }), error => {
    assert.equal(error.code, 1); assert.ok(error.stderr.includes('Usage:'));
    assert.ok(!error.stderr.includes('private-argument-canary')); assert.equal(error.stdout, ''); return true;
  });
});

test('CLI missing explicit GC writes an incomplete selected artifact and safe failure before creating PostgreSQL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-workload-command-'));
  const output = join(directory, 'result.json');
  try {
    await assert.rejects(promisify(execFile)(process.execPath,
      ['scripts/measure-wanted-guarded-workload.js', '--output', output, '--source-noops', '--profiles', 'sine', '--bindings', '2', '--pairs', '1'],
      { windowsHide: true, timeout: 10_000 }), error => {
      assert.equal(error.code, 1); assert.equal(error.stdout, '');
      assert.ok(error.stderr.startsWith('[wanted-workload-failure] '));
      assert.ok(!error.stderr.includes(directory)); return true;
    });
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.version, 2); assert.equal(report.completed, false);
    assert.equal(report.plan.scope, 'selected'); assert.equal(report.plan.expectedSamples, 2);
    assert.deepEqual(report.samples, []); assert.equal(report.failure.errorClass, 'TypeError');
    assert.ok(report.failure.frames.some(frame => frame.file === 'testing/integration/wanted-distinct-binding-policy.js'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
