/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { opendir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assertFolderProfileVariant } from './folder-profile-variants.js';
import { folderProfileName } from './folder-profile-fixture.js';

const barrier = () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
};

/** First-read delivery is controlled; subsequent read/stat Promises stay native. */
export function createFolderProfileGroup({ createService, path, bufferSize, holdCloses = false, filesystem = { opendir, stat } }) {
  assertFolderProfileVariant('stream', bufferSize);
  const reads = barrier(), closes = barrier(), readReady = barrier(), closeReady = barrier();
  const counts = { directoryOpens: 0, directoryCloses: 0, closeDispatches: 0, directoryReads: 0, firstReads: 0,
    bufferChecks: 0, stats: 0, liveHandles: 0, peakHandles: 0, closeArrivals: 0 };
  const service = createService({
    readStat: (...args) => { counts.stats++; return filesystem.stat(...args); },
    openDirectory: async (directoryPath, options) => {
      assert.deepEqual(options, { bufferSize: 32 }); counts.bufferChecks++;
      const directory = await filesystem.opendir(directoryPath, { ...options, bufferSize });
      counts.directoryOpens++; counts.liveHandles++; counts.peakHandles = Math.max(counts.peakHandles, counts.liveHandles);
      let first = true;
      return {
        read() {
          counts.directoryReads++;
          const pending = directory.read();
          if (!first) return pending;
          first = false;
          // Dispatch native I/O before the barrier; do not claim it stays in-kernel.
          if (++counts.firstReads === 4) readReady.release();
          return pending.then(async entry => { await reads.promise; return entry; });
        },
        async close() {
          // Failure before the read rendezvous must drain, not wait on its peers.
          if (counts.firstReads < 4) { reads.release(); closes.release(); }
          if (++counts.closeArrivals === 4) closeReady.release();
          if (holdCloses) await closes.promise;
          counts.closeDispatches++; await directory.close();
          counts.directoryCloses++; counts.liveHandles--;
        },
      };
    },
  });
  const browse = signal => service.browse({ path, actorUserId: 'folder-profile-admin', signal });
  const controllers = Array.from({ length: 4 }, () => new AbortController());
  const tasks = controllers.map(controller => browse(controller.signal));
  const settled = Promise.allSettled(tasks);
  const checkpoint = promise => Promise.race([promise, Promise.all(tasks).then(() => { throw new Error('Group finished before checkpoint'); })]);
  return { counts, controllers, tasks, settled, browse,
    waitForReads: () => checkpoint(readReady.promise), waitForCloses: () => checkpoint(closeReady.promise),
    releaseReads: reads.release, releaseCloses: closes.release,
    // These owned releases and allSettled cannot replace the work rejection.
    run: async work => {
      try { return await work(); }
      finally { reads.release(); closes.release(); await settled; }
    },
  };
}

export function verifyFolderProfilePage(result) {
  assert.equal(result.page.total, 50_000); assert.equal(result.page.from, 1); assert.equal(result.page.to, 100);
  const names = result.entries.map(entry => entry.name);
  assert.deepEqual(names, Array.from({ length: 100 }, (_, index) => folderProfileName(index)));
  return createHash('sha256').update(names.map(name => name + '\n').join('')).digest('hex');
}

export function verifyFolderProfileRetirement(counts, requireFour = true) {
  assert.equal(counts.liveHandles, 0); assert.ok(counts.peakHandles <= 4);
  if (requireFour) assert.equal(counts.peakHandles, 4);
  assert.equal(counts.directoryOpens, counts.directoryCloses); assert.equal(counts.closeDispatches, counts.directoryCloses);
  assert.equal(counts.bufferChecks, counts.directoryOpens);
}
