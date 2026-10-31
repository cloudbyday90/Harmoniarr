/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMixedFirstPagePlan } from '../../testing/performance/folder-profile-blocks.js';
import { summarizeMixedFirstPage } from '../../testing/performance/folder-profile-block-summary.js';
import { parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';

const base = ['--image', 'sha256:' + 'a'.repeat(64), '--output', 'profile.json'];
const focused = [...base, '--storage', 'bind', '--scratch-root', 'C:/scratch', '--experiment', 'mixed-first-page'];

test('focused experiment admits only its declared storage, case, repetition and variants', () => {
  const selection = parseFolderProfileCommand(focused);
  assert.equal(selection.experiment, 'mixed-first-page'); assert.equal(selection.comparison, 'buffers');
  assert.equal(selection.repeats, 4); assert.deepEqual(selection.cases, ['mixed']); assert.equal(createFolderProfilePlan(selection).length, 64);
  for (const extra of [['--cases', 'small'], ['--cases', 'mixed,large'], ['--comparison', 'algorithms'], ['--repeats', '5']]) {
    assert.throws(() => parseFolderProfileCommand([...focused, ...extra]));
  }
  assert.throws(() => parseFolderProfileCommand([...base, '--storage', 'volume', '--experiment', 'mixed-first-page']));
  assert.throws(() => parseFolderProfileCommand([...base, '--storage', 'volume', '--experiment', 'unknown']));
  assert.throws(() => createFolderProfilePlan({ ...selection, cases: ['large'] }));
  assert.throws(() => createFolderProfilePlan({ ...selection, storage: 'volume' }));
  assert.equal(parseFolderProfileCommand([...base, '--storage', 'volume']).experiment, 'standard');
});

test('randomized block plans balance buffer and observer order while preserving adjacent equal-work pairs', () => {
  for (const draw of [() => 0, max => max - 1]) {
    const plan = createMixedFirstPagePlan({ draw }); assert.equal(plan.length, 64);
    const identities = new Set();
    for (const [index, row] of plan.entries()) {
      assert.equal(row.sequence, index); assert.equal(row.pages, 1); assert.equal(row.caseName, 'mixed');
      const key = [row.block, row.repeat, row.observed, row.bufferSize].join('/'); assert.equal(identities.has(key), false); identities.add(key);
      if (index % 2 === 0) {
        const next = plan[index + 1];
        assert.deepEqual({ ...row, sequence: 0, bufferSize: 0 }, { ...next, sequence: 0, bufferSize: 0 }); assert.notEqual(row.bufferSize, next.bufferSize);
      }
    }
    for (let block = 0; block < 4; block++) {
      const rows = plan.filter(row => row.block === block);
      assert.equal(rows.length, 16);
      for (const observed of [true, false]) {
        assert.equal(rows.filter(row => row.observed === observed && row.sequence % 2 === 0 && row.bufferSize === 32).length, 2);
      }
      assert.equal(rows.filter(row => row.sequence % 4 === 0 && row.observed).length, 2);
    }
  }
  assert.notDeepEqual(createMixedFirstPagePlan({ draw: () => 0 }), createMixedFirstPagePlan({ draw: max => max - 1 }));
  for (const draw of [() => -1, max => max, () => 0.5]) assert.throws(() => createMixedFirstPagePlan({ draw }));
});

function measurements() {
  return createMixedFirstPagePlan({ draw: max => max - 1 }).map(row => ({ ...row,
    elapsedMs: row.bufferSize === 32 ? 100 : [50, 200, 100, 400][row.repeat], cpuMicros: { user: 1000, system: 500 },
    sampledPeakRss: 1100, baseline: { rss: 1000 }, value: { status: 'success', bufferSize: row.bufferSize } }));
}

test('summary preserves extreme samples, scoped memory and paired/block/order distributions', () => {
  const result = summarizeMixedFirstPage(measurements());
  assert.equal(result.descriptiveOnly, true); assert.equal(result.observations.length, 2);
  for (const row of result.observations) {
    assert.equal(row.successfulPairs, 16); assert.equal(row.faster128, 4); assert.equal(row.slower128, 8);
    assert.deepEqual(row.buffer128.elapsedMs, { count: 16, min: 50, median: 150, max: 400 });
    assert.deepEqual(row.pairedChangePercent, { count: 16, min: -50, median: 50, max: 300 });
    assert.equal(row.buffer32.sampledRssRiseBytes.median, 100);
    assert.ok(row.blocks.every(block => block.successfulPairs === 4)); assert.ok(row.order.every(order => order.successfulPairs === 8));
  }
});

test('refused pairs remain explicit and cannot become successful timing comparisons', () => {
  const rows = measurements(); rows[0].value.status = 'refused';
  const result = summarizeMixedFirstPage(rows), selected = result.observations.find(row => row.observed === rows[0].observed);
  assert.equal(selected.successfulPairs, 15); assert.equal(selected.refusedPairs, 1); assert.equal(selected.buffer32.elapsedMs.count, 15);
});

test('incomplete, duplicate, unbalanced and nonfinite evidence cannot produce a summary', () => {
  assert.throws(() => summarizeMixedFirstPage(measurements().slice(1)));
  for (const mutate of [rows => { rows[0] = rows[1]; }, rows => { rows[0].bufferSize = rows[1].bufferSize; },
    rows => { rows[0].observed = !rows[0].observed; rows[1].observed = rows[0].observed; },
    rows => { rows[0].elapsedMs = Infinity; }, rows => { rows[0].elapsedMs = 0; }, rows => { rows[0].cpuMicros.user = NaN; },
    rows => { rows[0].sampledPeakRss = 900; }]) {
    const rows = measurements(); mutate(rows); assert.throws(() => summarizeMixedFirstPage(rows));
  }
});
