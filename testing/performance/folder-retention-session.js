/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { opendir, stat } from 'node:fs/promises';
import { expectedFolderProfilePage } from './folder-profile-names.js';
import { folderProfileCases } from './folder-profile-policy.js';
import { verifyFolderProfilePage, verifyFolderProfileRetirement } from './folder-profile-group.js';

const barrier = () => { const { promise, resolve } = Promise.withResolvers(); return { promise, release: resolve }; };
const counters = () => ({ directoryOpens: 0, directoryCloses: 0, closeDispatches: 0, directoryReads: 0,
  bufferChecks: 0, stats: 0, liveHandles: 0, peakHandles: 0 });

/** One service/admission owner; each settled wave releases every page/controller/barrier reference. */
export function createFolderRetentionSession({ createService, path, filesystem = { opendir, stat }, caseName = 'long-ceiling' }) {
  const expected = expectedFolderProfilePage(folderProfileCases[caseName]);
  let current = null, counts = counters(), failed = false;
  const service = createService({
    readStat: (...args) => { assert.ok(current); counts.stats++; return filesystem.stat(...args); },
    openDirectory: async (directoryPath, options) => {
      const wave = current; assert.ok(wave); assert.deepEqual(options, { bufferSize: 128 }); counts.bufferChecks++;
      const directory = await filesystem.opendir(directoryPath, options);
      counts.directoryOpens++; counts.liveHandles++; counts.peakHandles = Math.max(counts.peakHandles, counts.liveHandles);
      let first = true;
      return {
        read() {
          counts.directoryReads++; const pending = directory.read();
          if (!first) return pending;
          first = false; if (++wave.firstReads === 4) wave.readReady.release();
          // Native dispatch precedes delayed delivery; this does not interrupt kernel I/O.
          return pending.then(async entry => { await wave.reads.promise; return entry; });
        },
        async close() {
          if (wave.firstReads < 4) { wave.reads.release(); wave.closes.release(); }
          if (++wave.closeArrivals === 4) wave.closeReady.release();
          if (wave.holdCloses) await wave.closes.promise;
          counts.closeDispatches++; await directory.close();
          // A rejected close leaves retirement uncertain, never a false zero.
          counts.directoryCloses++; counts.liveHandles--;
        },
      };
    },
  });
  const browse = signal => service.browse({ path, actorUserId: 'folder-retention-admin', signal });
  async function runWave(cancel) {
    assert.equal(current, null); assert.equal(counts.liveHandles, 0);
    const wave = { reads: barrier(), closes: barrier(), readReady: barrier(), closeReady: barrier(), firstReads: 0, closeArrivals: 0, holdCloses: cancel };
    current = wave;
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    // Invoke through a microtask so synchronous injected failures still own all siblings.
    const tasks = controllers.map(controller => Promise.resolve().then(() => browse(controller.signal)));
    const settled = Promise.allSettled(tasks);
    const checkpoint = promise => Promise.race([promise, Promise.all(tasks).then(() => { throw new Error('Wave finished before checkpoint'); })]);
    const busy = async () => {
      const before = { ...counts };
      await assert.rejects(browse(), error => error?.code === 'folder_browse_busy'); assert.deepEqual(counts, before);
    };
    try {
      await checkpoint(wave.readReady.promise); assert.equal(counts.liveHandles, 4); await busy();
      if (cancel) controllers[0].abort();
      wave.reads.release();
      if (cancel) {
        await checkpoint(wave.closeReady.promise); assert.equal(counts.liveHandles, 4);
        assert.equal(counts.closeDispatches, counts.directoryCloses); await busy(); controllers[1].abort();
      }
      wave.closes.release();
      const outcomes = await settled;
      for (const [index, row] of outcomes.entries()) {
        if (row.status === 'rejected' && !(cancel && index < 2 && row.reason?.name === 'AbortError')) throw row.reason;
      }
      assert.deepEqual(outcomes.map(row => row.status), cancel ? ['rejected', 'rejected', 'fulfilled', 'fulfilled'] : Array(4).fill('fulfilled'));
      if (cancel) for (const row of outcomes.slice(0, 2)) assert.equal(row.reason?.name, 'AbortError');
      const digests = outcomes.filter(row => row.status === 'fulfilled').map(row => verifyFolderProfilePage(row.value, expected));
      assert.equal(new Set(digests).size, 1); verifyFolderProfileRetirement(counts);
      return digests[0];
    } finally {
      wave.reads.release(); wave.closes.release(); await settled; current = null;
    }
  }
  return {
    idleState: () => ({ liveHandles: counts.liveHandles, waveActive: current !== null }),
    async cycle() {
      assert.equal(failed, false, 'A failed session cannot produce further qualification');
      assert.equal(current, null); assert.equal(counts.liveHandles, 0); counts = counters();
      try {
        const cancelledDigest = await runWave(true), digest = await runWave(false); assert.equal(digest, cancelledDigest);
        return { publishedScans: 6, abortedScans: 2, busyRefusals: 3, digest, counts: { ...counts } };
      } catch (error) { failed = true; throw error; }
    },
  };
}
