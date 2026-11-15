/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFolderBrowseService } from '../../src/server/filesystem/folder-browse-service.js';
import { createFolderRetentionSession } from '../../testing/performance/folder-retention-session.js';
import { observeFolderRetention } from '../../testing/performance/folder-retention-observer.js';
import { summarizeFolderRetention, folderRetentionPolicy } from '../../testing/performance/folder-retention-policy.js';
import { parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';
import { decodeFolderRetentionOutput } from '../../testing/performance/folder-retention-protocol.js';

const facts = () => ({ isDirectory: () => true, dev: 1n, ino: 2n, mtimeNs: 3n, ctimeNs: 4n });
function filesystem({ fault, closeGate } = {}) {
  const observed = { opens: 0, closed: 0, closing: 0, stats: 0 };
  return { observed,
    stat: async () => { if (++observed.stats === 1 && fault === 'stat') throw new Error('stat failure'); return facts(); },
    opendir: async (_path, options) => {
      assert.deepEqual(options, { bufferSize: 128 });
      const first = ++observed.opens === 1;
      if (first && fault === 'open') throw new Error('open failure');
      let index = 0;
      return {
        read() {
          if (first && fault === 'read-sync') throw new Error('dispatch failure');
          if (first && fault === 'read-async') return Promise.reject(new Error('read failure'));
          return Promise.resolve(index < 50_000 ? { name: 'folder-' + String(index++).padStart(5, '0'), isDirectory: () => true } : null);
        },
        async close() {
          observed.closing++; await closeGate?.();
          if (first && fault === 'close') throw new Error('close failure');
          observed.closed++;
        },
      };
    },
  };
}
const sessionOptions = fs => ({ createService: injected => createFolderBrowseService({ ...injected, now: () => 0 }), path: '/fixture', caseName: 'ceiling', filesystem: fs });

test('persistent selection fixes production-only modes and rejects altered workloads', () => {
  const base = ['--image', 'sha256:' + 'a'.repeat(64), '--output', 'private.json', '--experiment', 'persistent-retention'];
  for (const storage of ['volume', 'bind']) {
    const args = [...base, '--storage', storage, ...(storage === 'bind' ? ['--scratch-root', 'C:/scratch'] : [])];
    const selection = parseFolderProfileCommand(args);
    assert.deepEqual(createFolderProfilePlan(selection), [{ caseName: 'long-ceiling', mode: 'natural' }, { caseName: 'long-ceiling', mode: 'forced-gc' }]);
    for (const extra of [['--cases', 'ceiling'], ['--repeats', '2'], ['--comparison', 'buffers']]) assert.throws(() => parseFolderProfileCommand([...args, ...extra]));
    assert.throws(() => createFolderProfilePlan({ ...selection, storage: 'unknown' }));
  }
});

test('one persistent service reuses all four slots after each canceled wave and cycle', async () => {
  const fs = filesystem(); let factories = 0;
  const options = sessionOptions(fs), session = createFolderRetentionSession({ ...options, createService: injected => { factories++; return options.createService(injected); } });
  for (let index = 0; index < 3; index++) {
    const row = await session.cycle();
    assert.equal(row.publishedScans, 6); assert.equal(row.abortedScans, 2); assert.equal(row.busyRefusals, 3);
    assert.equal(row.counts.directoryReads, 350_008); assert.equal(row.counts.stats, 15);
    assert.equal(row.counts.directoryOpens, 8); assert.equal(row.counts.directoryCloses, 8);
    assert.deepEqual(session.idleState(), { liveHandles: 0, waveActive: false });
  }
  assert.equal(factories, 1); assert.equal(fs.observed.opens, 24); assert.equal(fs.observed.closed, 24);
});

test('actual close settlement keeps handles owned and prevents the recovery wave from starting', async () => {
  const gate = Promise.withResolvers(), ready = Promise.withResolvers(); let arrivals = 0;
  const fs = filesystem({ closeGate: () => { if (++arrivals === 4) ready.resolve(); return gate.promise; } });
  const session = createFolderRetentionSession(sessionOptions(fs));
  const pending = session.cycle();
  try {
    await ready.promise; assert.equal(fs.observed.opens, 4); assert.equal(fs.observed.closed, 0);
    assert.deepEqual(session.idleState(), { liveHandles: 4, waveActive: true });
  } finally { gate.resolve(); await pending; }
  assert.equal(fs.observed.opens, 8); assert.equal(fs.observed.closed, 8);
});

test('stat, open and native read failures drain siblings and seal the failed qualification session', async () => {
  for (const fault of ['stat', 'open', 'read-sync', 'read-async']) {
    const fs = filesystem({ fault }), session = createFolderRetentionSession(sessionOptions(fs));
    await assert.rejects(session.cycle());
    assert.deepEqual(session.idleState(), { liveHandles: 0, waveActive: false });
    assert.equal(fs.observed.closed, fault === 'open' ? fs.observed.opens - 1 : fs.observed.opens);
    await assert.rejects(session.cycle(), /failed session/u);
  }
});

test('rejected native close never becomes a successful retirement claim', async () => {
  const fs = filesystem({ fault: 'close' }), session = createFolderRetentionSession(sessionOptions(fs));
  await assert.rejects(session.cycle()); assert.equal(session.idleState().liveHandles, 1); assert.equal(session.idleState().waveActive, false);
  await assert.rejects(session.cycle(), /failed session/u);
});

test('deadline before the read rendezvous releases siblings and never starts a recovery wave', async () => {
  const fs = filesystem(), open = fs.opendir; let clock = 0;
  fs.opendir = async (...args) => { const directory = await open(...args); clock = 6000; return directory; };
  const session = createFolderRetentionSession({ ...sessionOptions(fs), createService: injected => createFolderBrowseService({ ...injected, now: () => clock }) });
  await assert.rejects(session.cycle(), error => error?.code === 'folder_browse_timeout');
  assert.equal(fs.observed.opens, 4); assert.equal(fs.observed.closed, 4); assert.deepEqual(session.idleState(), { liveHandles: 0, waveActive: false });
});

test('checkpoint failure preserves Error and null while all sibling invocations settle', async () => {
  for (const failure of [new Error('original'), null]) {
    let calls = 0, completed = 0;
    const session = createFolderRetentionSession({ path: '/fixture', caseName: 'ceiling', createService: () => ({ browse: async () => {
      if (++calls === 1) throw failure;
      await new Promise(resolve => { setImmediate(resolve); }); completed++;
    } }) });
    await assert.rejects(session.cycle(), error => error === failure); assert.equal(completed, 3);
  }
});

function observationOptions() {
  let completed = 0, factories = 0, collections = 0, reads = 0;
  const cgroup = () => ({ limitBytes: 1024 ** 3, swapMaxBytes: 0, cpus: 2, currentBytes: 4096, lifetimePeakBytes: 8192, events: { oom_kill: 0 } });
  const cycle = () => ({ publishedScans: 6, abortedScans: 2, busyRefusals: 3, digest: 'a'.repeat(64),
    counts: { directoryOpens: 8, directoryCloses: 8, closeDispatches: 8, liveHandles: 0, peakHandles: 4, directoryReads: 350_008, stats: 15, bufferChecks: 8 } });
  const dependencies = { createSession: () => { factories++; return { cycle: async () => { completed++; return cycle(); }, idleState: () => ({ liveHandles: 0, waveActive: false }) }; },
    idle: async () => {}, readMemory: () => { reads++; return { rss: 1000 + completed, heapUsed: 200 + completed, heapTotal: 500, external: 100, arrayBuffers: 50 }; },
    readCgroup: async () => cgroup(), readFds: async () => 19, readResources: () => ['PipeWrap', 'PipeWrap'], collect: () => { collections++; }, now: () => 100 };
  return { dependencies, observed: () => ({ completed, factories, collections, reads }) };
}

test('natural observation never forces GC; diagnostic collection follows completed cycle scope and idle', async () => {
  for (const mode of ['natural', 'forced-gc']) {
    const fixture = observationOptions(), rows = [];
    const dependencies = { ...fixture.dependencies, idle: async () => { rows.push(fixture.observed().completed); } };
    const report = await observeFolderRetention({ mode }, dependencies);
    assert.deepEqual(fixture.observed(), { completed: 15, factories: 1, collections: mode === 'natural' ? 0 : 16, reads: 16 });
    assert.deepEqual(rows, Array.from({ length: 16 }, (_, index) => index));
    assert.equal(report.analysis.fields.heapUsed.change, 12); assert.equal(report.analysis.measuredCycles, 12);
    assert.equal(report.analysis.completedScans, 90); assert.equal(report.analysis.abortedScans, 30);
    assert.deepEqual(report.checkpoints[0].resources, { PipeWrap: 2 });
    assert.ok(Buffer.byteLength(JSON.stringify(report)) < folderRetentionPolicy.maxReportBytes);
  }
});

test('work failure precedes further observers and cannot be replaced by an idle observation error', async () => {
  for (const failure of [new Error('work failure'), null]) {
    const { dependencies } = observationOptions(); let idleCalls = 0;
    dependencies.createSession = () => ({ idleState: () => ({ liveHandles: 0, waveActive: false }), cycle: async () => { throw failure; } });
    dependencies.idle = async () => { if (++idleCalls > 1) throw new Error('observer failure'); };
    await assert.rejects(observeFolderRetention({ mode: 'natural' }, dependencies), error => error === failure); assert.equal(idleCalls, 1);
  }
});

test('both modes retire auxiliary observations before sampling and await each checkpoint sink before more work', async () => {
  for (const mode of ['natural', 'forced-gc']) {
    const fixture = observationOptions(); let auxiliaryPending = false, sinkPending = false, yields = 0;
    const dependencies = { ...fixture.dependencies,
      readFds: async () => { auxiliaryPending = true; return 19; },
      afterAuxiliaryReads: async () => { assert.equal(auxiliaryPending, true); auxiliaryPending = false; yields++; },
      readResources: () => { assert.equal(auxiliaryPending, false); return []; },
      idle: async () => { assert.equal(sinkPending, false); },
      onCheckpoint: async () => { sinkPending = true; await new Promise(resolve => { setImmediate(resolve); }); sinkPending = false; },
    };
    await observeFolderRetention({ mode }, dependencies); assert.equal(yields, 16); assert.equal(sinkPending, false);
  }
});

test('checkpoint protocol binds chronology and owner, preserves complete partial lines, and verifies final evidence', async () => {
  const fixture = observationOptions(), records = [], owner = 'owned-profile';
  const report = await observeFolderRetention({ mode: 'natural' }, { ...fixture.dependencies,
    onCheckpoint: async row => { records.push({ owner, phase: 'retention-checkpoint', ...row }); },
  });
  const prefix = records.map(row => JSON.stringify(row) + '\n').join('');
  const final = { owner, phase: 'retention', result: report };
  assert.deepEqual(decodeFolderRetentionOutput(prefix + JSON.stringify(final), owner), final);
  const partial = decodeFolderRetentionOutput(prefix + '{"interrupted', owner, true);
  assert.equal(partial.status, 'incomplete'); assert.equal(partial.checkpoints.length, 16); assert.equal(partial.cycles.length, 15);
  assert.throws(() => decodeFolderRetentionOutput(prefix, owner));
  assert.throws(() => decodeFolderRetentionOutput(prefix, 'different', true));
  assert.throws(() => decodeFolderRetentionOutput(JSON.stringify(records[0]) + '\n' + prefix, owner, true));
  const changed = structuredClone(final); changed.result.cycles[3].digest = 'b'.repeat(64);
  assert.throws(() => decodeFolderRetentionOutput(prefix + JSON.stringify(changed), owner));
  assert.throws(() => decodeFolderRetentionOutput('x'.repeat(folderRetentionPolicy.maxReportBytes * 2 + 1), owner, true));
});

test('invalid memory, descriptor growth and incomplete or oversized evidence cannot produce a successful summary', async () => {
  const fixture = observationOptions(), report = await observeFolderRetention({ mode: 'natural' }, fixture.dependencies);
  const mutations = [row => { row.cycles.pop(); }, row => { row.checkpoints[4].afterCycle = 3; },
    row => { row.cycles[4].cycle = 4; }, row => { row.checkpoints[3].memory.rss = NaN; },
    row => { row.checkpoints[2].fdCount++; }, row => { row.cycles[2].counts.liveHandles = 1; },
    row => { row.checkpoints[1].cgroup.events.oom_kill++; }, row => { row.checkpoints[1].cgroup.currentBytes = Infinity; },
    row => { row.elapsedMs = NaN; }, row => { row.extra = 'x'.repeat(folderRetentionPolicy.maxReportBytes); }];
  for (const mutate of mutations) { const invalid = structuredClone(report); mutate(invalid); assert.throws(() => summarizeFolderRetention(invalid)); }
  const { dependencies } = observationOptions(); dependencies.readMemory = () => ({ rss: Infinity });
  await assert.rejects(observeFolderRetention({ mode: 'natural' }, dependencies), /Invalid idle memory/u);
});
