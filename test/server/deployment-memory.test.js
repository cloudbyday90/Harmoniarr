/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { parseDeploymentMemory, measureDeploymentMemory } from '../../testing/server/deployment-memory-observer.js';
import { withDeploymentDatabaseWork } from '../../testing/server/deployment-memory-database.js';

const raw = { current: '100', peak: '150', limit: '1024', stat: 'anon 40\nfile 50\nshmem 10\nkernel 10\nprivate_extra 999', events: 'max 0\noom 0\noom_kill 0' };
const kernel = () => parseDeploymentMemory(raw);
const processMemory = () => ({ rss: 90, heapUsed: 10, external: 30, arrayBuffers: 20, privateExtra: 'must not escape' });

test('deployment memory projects overlapping counters separately and refuses unavailable finite controls', () => {
  assert.deepEqual(kernel(), { version: 2, usagePrecision: 'cgroup-current', currentBytes: 100, lifetimePeakBytes: 150, limitBytes: 1024,
    categories: { anon: 40, file: 50, kernel: 10, shmem: 10 }, events: { max: 0, oom: 0, oom_kill: 0 } });
  for (const patch of [{ limit: 'max' }, { limit: '0' }, { current: '-1' }, { peak: '9007199254740992' },
    { stat: raw.stat + '\nfile 1' }, { stat: 'anon 40\nfile 50\nkernel 10' }, { events: 'max 0\noom 0' }]) {
    assert.throws(() => parseDeploymentMemory({ ...raw, ...patch }), TypeError);
  }
});

test('cgroup v1 evidence labels approximate usage and does not fabricate an OOM-event counter', () => {
  const input = { ...raw, version: 1, stat: 'total_rss 40\ntotal_cache 50\ntotal_mapped_file 10', failcnt: '2', events: 'under_oom 0\noom_kill 0' };
  const value = parseDeploymentMemory(input);
  assert.equal(value.usagePrecision, 'approximate-v1'); assert.deepEqual(value.events, { max: 2, oom: null, oom_kill: 0 });
  assert.deepEqual(value.categories, { total_rss: 40, total_cache: 50, total_mapped_file: 10 });
  assert.throws(() => parseDeploymentMemory({ ...input, failcnt: '-1' }), TypeError);
  assert.throws(() => parseDeploymentMemory({ ...input, events: 'under_oom 0' }), TypeError);
});

test('measurement keeps current observations separate from lifetime peak and revokes checkpoint ownership', async () => {
  let late;
  const measured = await measureDeploymentMemory(async checkpoint => {
    late = checkpoint; await checkpoint('admitted'); await checkpoint('publication');
    await assert.rejects(checkpoint('publication'), TypeError); return 'owned-result';
  }, { readKernel: async () => kernel(), readProcess: processMemory });
  assert.equal(measured.result, 'owned-result'); assert.equal(measured.samples, 4);
  assert.equal(measured.sampledCurrentPeakBytes, 100); assert.equal(measured.checkpoints.settled.kernel.lifetimePeakBytes, 150);
  assert.deepEqual(measured.processPeaks, { rss: 90, heapUsed: 10, external: 30, arrayBuffers: 20 });
  await assert.rejects(late('admitted'), TypeError);
});

test('slow periodic reads never overlap or accumulate and are drained before settlement', async () => {
  const entered = Promise.withResolvers(); const release = Promise.withResolvers(); let reads = 0; let active = 0; let peak = 0;
  const result = measureDeploymentMemory(async () => { await entered.promise;
    try { await delay(25); assert.equal(reads, 2); } finally { release.resolve(); }
  }, {
    intervalMs: 5, readProcess: processMemory, readKernel: async () => {
      reads++; active++; peak = Math.max(peak, active);
      if (reads === 2) { entered.resolve(); await release.promise; }
      active--; return kernel();
    },
  });
  try { await result; } finally { release.resolve(); }
  assert.equal(active, 0); assert.equal(peak, 1);
});

test('sampling failures fail measurement while preserving an original Error or null', async () => {
  const unavailable = new Error('counter-unavailable'); const observed = Promise.withResolvers(); let observations = 0;
  await assert.rejects(measureDeploymentMemory(async checkpoint => { await observed.promise; await checkpoint('admitted'); }, {
    intervalMs: 5, readProcess: processMemory, readKernel: async () => {
      if (++observations > 1) { observed.resolve(); throw unavailable; } return kernel();
    },
  }), error => error === unavailable);
  for (const original of [new Error('original'), null]) {
    const entered = Promise.withResolvers(); let reads = 0;
    const measured = measureDeploymentMemory(async () => { await entered.promise; throw original; }, {
      intervalMs: 5, readProcess: processMemory, readKernel: async () => {
        if (++reads > 1) { entered.resolve(); throw new Error('counter-unavailable'); } return kernel();
      },
    });
    await assert.rejects(measured, error => error === original);
  }
  await assert.rejects(measureDeploymentMemory(async checkpoint => { await checkpoint('admitted'); }, {
    readKernel: async () => kernel(), readProcess: () => ({ ...processMemory(), arrayBuffers: NaN }),
  }), TypeError);
});

test('database retirement handles reversed lock acquisition and drains every client after Error/null', async () => {
  for (const original of [undefined, new Error('work'), null]) {
    const order = []; const first = Promise.withResolvers(); const second = Promise.withResolvers(); let index = 0;
    const gate = { query: async sql => { if (sql.includes('unlock')) second.resolve({ rows: [{ bytes: 12_800_000 }] }); }, release() { order.push('gate-released'); } };
    const clients = [first, second].map((job, i) => ({ async query(sql) {
      if (sql.startsWith('WITH')) return job.promise;
      if (sql === 'ROLLBACK') { order.push(`rollback-${i}`); if (i === 1) first.resolve({ rows: [{ bytes: 12_800_000 }] }); }
    }, release() { order.push(`release-${i}`); } }));
    const pool = { connect: async () => index++ === 0 ? gate : clients[index - 2], query: async () => ({ rows: [{ count: 2 }] }) };
    const task = withDeploymentDatabaseWork(pool, async () => { if (original !== undefined) throw original; return 'done'; });
    if (original === undefined) assert.equal(await task, 'done'); else await assert.rejects(task, error => error === original);
    assert.ok(order.indexOf('rollback-1') < order.indexOf('rollback-0'));
    assert.deepEqual(order.filter(value => value.startsWith('release-')).sort(), ['release-0', 'release-1']); assert.equal(order.at(-1), 'gate-released');
  }
});
