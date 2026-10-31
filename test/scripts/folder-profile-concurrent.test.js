/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFolderBrowseService } from '../../src/server/filesystem/folder-browse-service.js';
import { createConcurrentFolderProfileWorkload, runConcurrentFolderProfileControls } from '../../testing/performance/folder-profile-concurrent-workload.js';
import { createConcurrentCeilingPlan, summarizeConcurrentCeiling } from '../../testing/performance/folder-profile-concurrent-plan.js';
import { parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';
import { createFolderProfileGroup } from '../../testing/performance/folder-profile-group.js';

const base = ['--image', 'sha256:' + 'a'.repeat(64), '--output', 'profile.json', '--experiment', 'concurrent-ceiling'];
const facts = () => ({ isDirectory: () => true, dev: 1n, ino: 2n, mtimeNs: 3n, ctimeNs: 4n });
function filesystem({ count = 50_000, afterStat } = {}) {
  const observed = { opens: [], closes: 0, stats: 0 };
  return { observed, stat: () => { observed.stats++; return Promise.resolve(afterStat?.(observed.stats) ?? facts()); },
    opendir: async (path, options) => {
      observed.opens.push({ path, options }); let index = 0;
      return { read: () => Promise.resolve(index < count ? { name: 'folder-' + String(index++).padStart(5, '0'), isDirectory: () => true } : null),
        close: async () => { observed.closes++; } };
    } };
}
const options = fs => ({ createService: createFolderBrowseService, path: '/fixture', filesystem: fs });

test('concurrent experiment fixes the ceiling workload and permits both explicit storage profiles', () => {
  for (const storage of ['volume', 'bind']) {
    const args = [...base, '--storage', storage, ...(storage === 'bind' ? ['--scratch-root', 'C:/scratch'] : [])];
    const selection = parseFolderProfileCommand(args), plan = createFolderProfilePlan(selection);
    assert.deepEqual(selection.cases, ['ceiling']); assert.equal(selection.repeats, 4); assert.equal(selection.comparison, 'buffers');
    assert.equal(plan.length, 16); assert.ok(plan.every(row => row.concurrency === 4 && row.pages === 1 && row.caseName === 'ceiling'));
    for (const extra of [['--cases', 'large'], ['--repeats', '3'], ['--comparison', 'algorithms']]) assert.throws(() => parseFolderProfileCommand([...args, ...extra]));
    assert.throws(() => createFolderProfilePlan({ ...selection, cases: ['mixed'] }));
    assert.throws(() => createFolderProfilePlan({ ...selection, storage: 'unknown' }));
  }
});

test('four ceiling pages share one admission owner, verify independent names and retire all handles for both buffers', async () => {
  for (const bufferSize of [32, 128]) {
    const fs = filesystem(); let factories = 0;
    const work = createConcurrentFolderProfileWorkload({ ...options(fs), bufferSize, createService: injected => { factories++; return createFolderBrowseService(injected); } });
    const row = await work();
    assert.equal(factories, 1); assert.equal(row.status, 'success'); assert.equal(row.completedScans, 4);
    assert.equal(new Set(row.digests).size, 1); assert.equal(row.counts.peakHandles, 4); assert.equal(row.counts.liveHandles, 0);
    assert.equal(row.counts.directoryReads, 200_004); assert.equal(fs.observed.stats, 8); assert.equal(fs.observed.closes, 4);
    assert.ok(fs.observed.opens.every(item => item.options.bufferSize === bufferSize));
  }
});

test('fifth calls refuse without I/O during held read and close; read and late-close aborts cannot publish', async () => {
  for (const bufferSize of [32, 128]) {
    const fs = filesystem(), row = await runConcurrentFolderProfileControls({ ...options(fs), bufferSize });
    assert.equal(row.busyBeforeReadRelease, true); assert.equal(row.busyBeforeNativeClose, true);
    assert.equal(row.abortedScans, 2); assert.equal(row.publishedScans, 2); assert.equal(row.resumedScan, true);
    assert.equal(row.counts.directoryReads, 200_005); assert.equal(row.counts.stats, 9);
    assert.equal(fs.observed.opens.length, 5); assert.equal(fs.observed.closes, 5); assert.equal(row.counts.liveHandles, 0);
  }
});

test('overflow and metadata refusals retain whole-group failure and drain every held handle', async () => {
  for (const bufferSize of [32, 128]) for (const changed of [false, true]) {
    const fs = filesystem(changed ? { afterStat: call => ({ ...facts(), ino: call > 4 ? 3n : 2n }) } : { count: 50_001 });
    const row = await createConcurrentFolderProfileWorkload({ ...options(fs), bufferSize })();
    assert.equal(row.status, 'refused'); assert.equal(row.completedScans, 0);
    assert.deepEqual(row.refusalCodes, Array(4).fill(changed ? 'folder_page_changed' : 'folder_scan_limit'));
    assert.equal(row.counts.liveHandles, 0); assert.equal(fs.observed.closes, 4);
  }
});

test('checkpoint failures release and drain siblings while preserving Error or null', async () => {
  for (const failure of [new Error('early failure'), null]) for (const controls of [false, true]) {
    let completed = 0, calls = 0;
    const createService = () => ({ browse: async () => {
      if (++calls === 1) throw failure;
      await new Promise(resolve => { setImmediate(resolve); }); completed++;
    } });
    const input = { ...options(filesystem()), bufferSize: 32, createService };
    await assert.rejects(controls ? runConcurrentFolderProfileControls(input) : createConcurrentFolderProfileWorkload(input)(), error => error === failure);
    assert.equal(completed, 3);
  }
});

test('group observers preserve subsequent native Promises and await actual close settlement', async () => {
  let closeArrivals = 0, releaseClose, notifyClosing;
  const closing = new Promise(resolve => { releaseClose = resolve; }), ready = new Promise(resolve => { notifyClosing = resolve; });
  const stat = Promise.resolve(facts()), nativeSeconds = new Set();
  const fs = { stat: () => stat, opendir: async () => {
    let calls = 0; const second = Promise.resolve(null); nativeSeconds.add(second);
    return { read: () => ++calls === 1 ? Promise.resolve(null) : second,
      close: async () => { if (++closeArrivals === 4) notifyClosing(); await closing; } };
  } };
  const createService = injected => ({ browse: async () => {
    assert.equal(injected.readStat('/fixture'), stat);
    const handle = await injected.openDirectory('/fixture', { bufferSize: 32 });
    await handle.read(); const second = handle.read(); assert.ok(nativeSeconds.has(second));
    await second; await handle.close();
  } });
  const group = createFolderProfileGroup({ ...options(fs), bufferSize: 128, createService });
  await group.run(async () => {
    try {
      await group.waitForReads(); group.releaseReads();
      await Promise.race([ready, Promise.all(group.tasks)]);
      assert.equal(closeArrivals, 4); assert.equal(group.counts.directoryCloses, 0); assert.equal(group.counts.liveHandles, 4);
    } finally { releaseClose(); }
    await Promise.all(group.tasks); assert.equal(group.counts.directoryCloses, 4); assert.equal(group.counts.liveHandles, 0);
  });
});

test('deadline refusals after controlled native dispatch drain all four scans without publishing partial pages', async () => {
  for (const bufferSize of [32, 128]) {
    let clock = 0, reads = 0;
    const fs = filesystem(), originalOpen = fs.opendir;
    fs.opendir = async (...args) => {
      const native = await originalOpen(...args), read = native.read;
      return { ...native, read: () => { if (++reads === 4) clock = 6000; return read(); } };
    };
    const row = await createConcurrentFolderProfileWorkload({ ...options(fs), bufferSize,
      createService: injected => createFolderBrowseService({ ...injected, now: () => clock }) })();
    assert.equal(row.status, 'refused'); assert.equal(row.completedScans, 0);
    assert.deepEqual(row.refusalCodes, Array(4).fill('folder_browse_timeout')); assert.equal(fs.observed.closes, 4);
  }
});

test('failure before the four-read checkpoint releases held siblings and closes without waiting for an outer timeout', async () => {
  for (const bufferSize of [32, 128]) for (const beforeRead of [false, true]) {
    let opened = 0, completed = false, clock = 0;
    const fs = { stat: async () => facts(), opendir: async () => {
      if (beforeRead) clock = 6000;
      const first = ++opened === 1;
      return { read: () => { if (first) throw new Error('native dispatch failure'); return Promise.resolve(null); }, close: async () => {} };
    } };
    const group = createFolderProfileGroup({ ...options(fs), bufferSize, holdCloses: true,
      createService: injected => createFolderBrowseService({ ...injected, now: () => clock }) });
    const outcome = group.run(async () => { await group.waitForReads(); group.releaseReads(); await Promise.all(group.tasks); })
      .then(() => { completed = true; return null; }, error => { completed = true; return error; });
    try {
      await new Promise(resolve => { setImmediate(resolve); });
      assert.equal(completed, true); assert.equal(group.counts.liveHandles, 0);
      assert.equal((await outcome)?.code, beforeRead ? 'folder_browse_timeout' : 'folder_read_failed');
    } finally { group.releaseReads(); group.releaseCloses(); await outcome; }
  }
});

function measurements() {
  return createConcurrentCeilingPlan({ draw: max => max - 1 }).map(row => ({ ...row,
    elapsedMs: row.bufferSize === 32 ? 100 : [50, 200, 100, 400][row.repeat], cpuMicros: { user: 1000, system: 500 },
    sampledPeakRss: 1100, baseline: { rss: 1000 }, cgroupBefore: { currentBytes: 2000, events: { oom_kill: 0 } },
    cgroupAfter: { currentBytes: 2100, lifetimePeakBytes: 3000, events: { oom_kill: 0 } },
    value: { status: 'success', bufferSize: row.bufferSize, concurrency: 4 } }));
}
test('concurrent summary keeps balanced pairs, extreme observations and distinct memory scopes', () => {
  for (const row of summarizeConcurrentCeiling(measurements()).observations) {
    assert.equal(row.successfulPairs, 4); assert.equal(row.refusedPairs, 0); assert.equal(row.faster128, 1); assert.equal(row.slower128, 2);
    assert.deepEqual(row.pairedChangePercent, { count: 4, min: -50, median: 50, max: 300 });
    assert.equal(row.variants[1].sampledProcessRssBytes.median, 1100);
    assert.equal(row.variants[1].sampledProcessRssRiseBytes.median, 100);
    assert.equal(row.variants[1].containerLifetimePeakBytes.median, 3000);
  }
  const rows = measurements(); rows[0].value.status = 'refused';
  const selected = summarizeConcurrentCeiling(rows).observations.find(row => row.observed === rows[0].observed);
  assert.equal(selected.successfulPairs, 3); assert.equal(selected.refusedPairs, 1);
});

test('incomplete, duplicate, unbalanced, nonfinite and OOM evidence cannot produce a concurrent summary', () => {
  assert.throws(() => summarizeConcurrentCeiling(measurements().slice(1)));
  for (const mutate of [rows => { rows[0] = rows[1]; }, rows => { rows[0].concurrency = 1; },
    rows => { rows[0].observed = !rows[0].observed; rows[1].observed = rows[0].observed; },
    rows => { rows[0].elapsedMs = Infinity; }, rows => { rows[0].sampledPeakRss = 900; },
    rows => { rows[0].cgroupAfter.lifetimePeakBytes = NaN; }, rows => { rows[0].cgroupAfter.events.oom_kill = 1; }]) {
    const rows = measurements(); mutate(rows); assert.throws(() => summarizeConcurrentCeiling(rows));
  }
});
