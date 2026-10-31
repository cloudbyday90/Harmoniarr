/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createBalancedFolderProfileBlock } from './folder-profile-blocks.js';

/** One balanced block; each sample contains four calls in one service/process. */
export const createConcurrentCeilingPlan = options => createBalancedFolderProfileBlock(options)
  .map(row => ({ ...row, caseName: 'ceiling', concurrency: 4 }));

const distribution = values => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { count: sorted.length, min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, max: sorted.at(-1) };
};

/** Keep group refusals explicit; memory scopes are separate, never additive. */
export function summarizeConcurrentCeiling(samples) {
  assert.equal(samples.length, 16);
  const pairs = [];
  for (let index = 0; index < samples.length; index += 2) {
    const pair = samples.slice(index, index + 2), [first, second] = pair;
    assert.equal(first.sequence, index); assert.equal(second.sequence, index + 1);
    assert.equal(first.block, 0); assert.equal(first.repeat, Math.floor(index / 4));
    for (const key of ['block', 'repeat', 'observed', 'caseName', 'pages', 'algorithm', 'concurrency']) assert.equal(first[key], second[key]);
    assert.equal(first.caseName, 'ceiling'); assert.equal(first.pages, 1); assert.equal(first.algorithm, 'stream'); assert.equal(first.concurrency, 4);
    assert.equal(typeof first.observed, 'boolean'); assert.deepEqual(pair.map(row => row.bufferSize).toSorted((a, b) => a - b), [32, 128]);
    for (const row of pair) {
      assert.ok(['success', 'refused'].includes(row.value.status)); assert.equal(row.value.bufferSize, row.bufferSize);
      assert.equal(row.value.concurrency, 4); assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs > 0);
      for (const value of [row.cpuMicros.user, row.cpuMicros.system, row.sampledPeakRss, row.baseline.rss,
        row.cgroupAfter.lifetimePeakBytes, row.cgroupBefore.currentBytes, row.cgroupAfter.currentBytes]) assert.ok(Number.isSafeInteger(value) && value >= 0);
      assert.ok(row.sampledPeakRss >= row.baseline.rss);
      assert.equal(row.cgroupAfter.events.oom_kill - row.cgroupBefore.events.oom_kill, 0);
    }
    pairs.push(pair);
  }
  assert.equal(pairs.filter(pair => pair[0].sequence % 4 === 0 && pair[0].observed).length, 2);
  return { samples: 16, concurrency: 4, descriptiveOnly: true, observations: [true, false].map(observed => {
    const selected = pairs.filter(pair => pair[0].observed === observed);
    assert.equal(selected.length, 4); assert.equal(selected.filter(pair => pair[0].bufferSize === 32).length, 2);
    assert.deepEqual(selected.map(pair => pair[0].repeat).toSorted(), [0, 1, 2, 3]);
    const complete = selected.filter(pair => pair.every(row => row.value.status === 'success'));
    const variants = [32, 128].map(bufferSize => {
      const rows = complete.map(pair => pair.find(row => row.bufferSize === bufferSize));
      return { bufferSize, elapsedMs: distribution(rows.map(row => row.elapsedMs)),
        cpuMs: distribution(rows.map(row => (row.cpuMicros.user + row.cpuMicros.system) / 1000)),
        sampledProcessRssBytes: distribution(rows.map(row => row.sampledPeakRss)),
        sampledProcessRssRiseBytes: distribution(rows.map(row => row.sampledPeakRss - row.baseline.rss)),
        containerLifetimePeakBytes: distribution(rows.map(row => row.cgroupAfter.lifetimePeakBytes)) };
    });
    const changes = complete.map(pair => (pair.find(row => row.bufferSize === 128).elapsedMs / pair.find(row => row.bufferSize === 32).elapsedMs - 1) * 100);
    return { observed, pairs: 4, successfulPairs: complete.length, refusedPairs: 4 - complete.length, variants,
      pairedChangePercent: distribution(changes), faster128: changes.filter(value => value < 0).length, slower128: changes.filter(value => value > 0).length };
  }) };
}
