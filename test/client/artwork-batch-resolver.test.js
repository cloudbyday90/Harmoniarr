/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkBatchResolver } from '../../src/client/lib/artwork-batch-resolver.js';

const flush = () => new Promise((resolve) => { setImmediate(resolve); });

test('artwork resolver shares two request slots across overlapping calls and caps batches at 50', async () => {
  let active = 0;
  let maximum = 0;
  const batches = [];
  const releases = [];
  const resolver = createArtworkBatchResolver({ batchResolveFn: async (batch) => {
    active += 1;
    maximum = Math.max(maximum, active);
    batches.push(batch);
    await new Promise((resolve) => { releases.push(resolve); });
    active -= 1;
    return { resolved: {} };
  } });
  const first = resolver.resolveBatches(Array.from({ length: 251 }, (_, index) => index));
  const second = resolver.resolveBatches(Array.from({ length: 101 }, (_, index) => index + 1000));
  for (let count = 0; count < 9; ) {
    await flush();
    const pending = releases.splice(0);
    assert.ok(pending.length > 0);
    count += pending.length;
    pending.forEach((resolve) => { resolve(); });
  }
  await Promise.all([first, second]);
  assert.equal(maximum, 2);
  assert.equal(batches.length, 9);
  assert.ok(batches.every((batch) => batch.length <= 50));
  assert.equal(new Set(batches.flat()).size, 352);
});

test('successful artwork batches publish despite sibling failures', async () => {
  const maps = [];
  const resolver = createArtworkBatchResolver({ batchResolveFn: async (batch) => {
    if (batch[0] === 50) throw new Error('one batch failed');
    return { resolved: { [batch[0]]: { url: 'cover' } } };
  } });
  const result = await resolver.resolveBatches(Array.from({ length: 120 }, (_, index) => index), { onResolved: (map) => maps.push(map) });
  assert.deepEqual(result, { completedBatches: 2, failedBatches: 1, cancelledBatches: 0 });
  assert.deepEqual(maps, [{ 0: { url: 'cover' } }, { 100: { url: 'cover' } }]);
});

test('cancelled artwork generations stop scheduling and never publish late results', async () => {
  let current = true;
  let calls = 0;
  const releases = [];
  const published = [];
  const resolver = createArtworkBatchResolver({ batchResolveFn: async () => {
    calls += 1;
    await new Promise((resolve) => { releases.push(resolve); });
    return { resolved: { stale: true } };
  } });
  const work = resolver.resolveBatches(Array(200).fill({}), { shouldContinue: () => current, onResolved: (map) => published.push(map) });
  await flush();
  current = false;
  releases.forEach((resolve) => { resolve(); });
  assert.deepEqual(await work, { completedBatches: 0, failedBatches: 0, cancelledBatches: 4 });
  assert.equal(calls, 2);
  assert.deepEqual(published, []);
});
