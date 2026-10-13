/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWantedGuardedCostObserver } from '../../testing/integration/wanted-guarded-cost-observer.js';
import { createOperatorTrackRootContextStore } from '../../src/server/metadata/operator-track-root-context-store.js';
import { measureWantedGuardedWorkload } from '../../testing/integration/wanted-guarded-benchmark.js';

test('actual root store classifies one awaited statement without retaining SQL, values or rows', async () => {
  let now = 0; let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const observer = createWantedGuardedCostObserver({ now: () => now });
  const store = createOperatorTrackRootContextStore({ getPoolFn: () => assert.fail('Must use owning queryable') });
  const queryable = { query: (text, values) => observer.query(text, async () => {
    assert.deepEqual(values, ['private-owner']); entered(); await held; now = 12;
    return { rows: [{ id: 'private-owner', music_root: 'private-path' }] };
  }) };
  const pending = store.readOwnerRootContext({ ownerId: 'private-owner', queryable });
  await started; assert.equal(observer.snapshot().queries.rootContext.elapsedMs, 0);
  release(); assert.equal((await pending).owner.id, 'private-owner');
  await observer.query('SELECT private-other', async () => { now = 15; return 'private-result'; });
  const result = observer.snapshot();
  assert.deepEqual(result.queries, { rootContext: { count: 1, failures: 0, elapsedMs: 12 },
    other: { count: 1, failures: 0, elapsedMs: 3 } });
  assert.equal(result.memoryWindows.rootQuery.count, 1);
  assert.equal(JSON.stringify(result).includes('private'), false);
  result.queries.rootContext.count = 999;
  assert.equal(observer.snapshot().queries.rootContext.count, 1);
});

test('signed memory changes retain only fixed ranges and close once, including GC decreases', () => {
  let value = 100; const observer = createWantedGuardedCostObserver({ readMemory: () => ({
    rss: value, heapUsed: value + 1, external: value + 2, arrayBuffers: value + 3, private: 'secret' }) });
  const first = observer.openWindow('projection'); value = 80; first(); first();
  const second = observer.openWindow('projection'); value = 130; second();
  const record = observer.snapshot();
  assert.equal(record.memoryWindows.projection.count, 2);
  assert.deepEqual(record.memoryWindows.projection.changes.heapUsed, { min: -20, max: 50 });
  assert.equal(record.memoryWindows.projection.unavailable, 0);
  assert.equal(JSON.stringify(record).includes('secret'), false);
  assert.throws(() => observer.openWindow('private-name'), TypeError);
});

test('unavailable clocks and memory cannot replace the original query Error/null', async () => {
  for (const primary of [new Error('private-original'), null]) {
    const observer = createWantedGuardedCostObserver({ now: () => { throw new Error('private-clock'); },
      readMemory: () => { throw new Error('private-memory'); } });
    let sql;
    const store = createOperatorTrackRootContextStore();
    await store.readOwnerRootContext({ ownerId: 'private-owner', queryable: { query: async text => { sql = text; return { rows: [] }; } } });
    await assert.rejects(observer.query(sql, async () => { throw primary; }), error => error === primary);
    const record = observer.snapshot();
    assert.equal(record.queries.rootContext.failures, 1);
    assert.equal(record.memoryWindows.rootQuery.unavailable, 1);
    assert.equal(record.memoryWindows.rootQuery.changes.heapUsed.min, null);
    assert.equal(record.timingUnavailable, true);
    assert.equal(JSON.stringify(record).includes('private'), false);
  }
});

test('incompatible benchmark modes reject before runtime acquisition', async () => {
  await assert.rejects(measureWantedGuardedWorkload({ groupingComparison: true, rootCostComparison: true, gc: () => {} }), TypeError);
  await assert.rejects(measureWantedGuardedWorkload({ rootCostComparison: 'yes', gc: () => {} }), TypeError);
});
