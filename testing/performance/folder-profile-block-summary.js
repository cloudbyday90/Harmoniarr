/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

const distribution = values => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { count: sorted.length, min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, max: sorted.at(-1) };
};
function summarizePairs(pairs) {
  const complete = pairs.filter(pair => pair.every(row => row.value.status === 'success'));
  const variant = buffer => {
    const rows = complete.map(pair => pair.find(row => row.bufferSize === buffer));
    return { elapsedMs: distribution(rows.map(row => row.elapsedMs)),
      cpuMs: distribution(rows.map(row => (row.cpuMicros.user + row.cpuMicros.system) / 1000)),
      sampledRssRiseBytes: distribution(rows.map(row => row.sampledPeakRss - row.baseline.rss)) };
  };
  const percentages = complete.map(pair => {
    const before = pair.find(row => row.bufferSize === 32).elapsedMs, after = pair.find(row => row.bufferSize === 128).elapsedMs;
    return (after / before - 1) * 100;
  });
  return { pairs: pairs.length, successfulPairs: complete.length, refusedPairs: pairs.length - complete.length,
    buffer32: variant(32), buffer128: variant(128), pairedChangePercent: distribution(percentages),
    faster128: percentages.filter(value => value < 0).length, slower128: percentages.filter(value => value > 0).length };
}

/** Descriptive evidence only: no discarded slow observations or causal/significance claim. */
export function summarizeMixedFirstPage(samples) {
  assert.equal(samples.length, 64);
  const pairs = [];
  for (let index = 0; index < samples.length; index += 2) {
    const pair = samples.slice(index, index + 2), [first, second] = pair;
    assert.equal(first.sequence, index); assert.equal(second.sequence, index + 1);
    assert.equal(first.block, Math.floor(index / 16)); assert.equal(first.repeat, Math.floor(index % 16 / 4));
    for (const key of ['block', 'repeat', 'observed', 'caseName', 'pages', 'algorithm']) assert.equal(first[key], second[key]);
    assert.equal(first.caseName, 'mixed'); assert.equal(first.pages, 1); assert.equal(first.algorithm, 'stream');
    assert.equal(typeof first.observed, 'boolean'); assert.deepEqual(pair.map(row => row.bufferSize).toSorted((a, b) => a - b), [32, 128]);
    for (const row of pair) {
      assert.ok(['success', 'refused'].includes(row.value.status)); assert.equal(row.value.bufferSize, row.bufferSize);
      assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs > 0);
      for (const value of [row.cpuMicros.user, row.cpuMicros.system, row.sampledPeakRss, row.baseline.rss]) assert.ok(Number.isSafeInteger(value) && value >= 0);
      assert.ok(row.sampledPeakRss >= row.baseline.rss);
    }
    pairs.push(pair);
  }
  for (let block = 0; block < 4; block++) {
    for (const observed of [true, false]) {
      const selected = pairs.filter(pair => pair[0].block === block && pair[0].observed === observed);
      assert.equal(selected.length, 4); assert.equal(selected.filter(pair => pair[0].bufferSize === 32).length, 2);
      assert.deepEqual(selected.map(pair => pair[0].repeat).toSorted(), [0, 1, 2, 3]);
    }
    assert.equal(pairs.filter(pair => pair[0].block === block && pair[0].sequence % 4 === 0 && pair[0].observed).length, 2);
  }
  return { version: 1, samples: 64, descriptiveOnly: true, observations: [true, false].map(observed => {
    const selected = pairs.filter(pair => pair[0].observed === observed);
    return { observed, ...summarizePairs(selected),
      blocks: Array.from({ length: 4 }, (_, block) => ({ block, ...summarizePairs(selected.filter(pair => pair[0].block === block)) })),
      order: [32, 128].map(firstBufferSize => ({ firstBufferSize, ...summarizePairs(selected.filter(pair => pair[0].bufferSize === firstBufferSize)) })) };
  }) };
}
