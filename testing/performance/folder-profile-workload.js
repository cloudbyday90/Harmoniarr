/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { opendir, readdir, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { folderProfileCases } from './folder-profile-policy.js';
import { folderProfileName } from './folder-profile-fixture.js';
import { assertFolderProfileVariant } from './folder-profile-variants.js';

export function createFolderProfileWorkload({ createService, path, caseName, algorithm, bufferSize = algorithm === 'stream' ? 32 : null, pages, filesystem = { opendir, readdir, stat } }) {
  if (!Object.hasOwn(folderProfileCases, caseName) || !['stream', 'readdir'].includes(algorithm) || ![1, 3].includes(pages)) throw new TypeError('Invalid measured workload');
  assertFolderProfileVariant(algorithm, bufferSize);
  const counts = { directoryOpens: 0, directoryCloses: 0, directoryReads: 0, bufferChecks: 0, stats: 0, readdirCalls: 0, returnedDirents: 0, liveHandles: 0, peakHandles: 0 };
  const service = createService({ readStat: (...args) => { counts.stats++; return filesystem.stat(...args); }, openDirectory: async (directoryPath, options) => {
    assert.deepEqual(options, { bufferSize: 32 }); counts.bufferChecks++;
    const directory = await filesystem.opendir(directoryPath, { ...options, bufferSize: bufferSize ?? 32 });
    counts.directoryOpens++; counts.liveHandles++; counts.peakHandles = Math.max(counts.peakHandles, counts.liveHandles);
    return { read: () => { counts.directoryReads++; return directory.read(); }, close: async () => { await directory.close(); counts.directoryCloses++; counts.liveHandles--; } };
  } });
  const profile = folderProfileCases[caseName];
  return async () => {
    const durations = [], digest = createHash('sha256'); let cursor, completedPages = 0, refusal = null;
    for (let index = 0; index < pages; index++) {
      const started = performance.now(); let names, total;
      try {
        if (algorithm === 'stream') {
          const result = await service.browse({ path, cursor, actorUserId: 'folder-profile-admin' });
          names = result.entries.map(entry => entry.name); total = result.page.total; cursor = result.page.nextCursor;
        } else {
          counts.readdirCalls++; const entries = await filesystem.readdir(path, { withFileTypes: true }); counts.returnedDirents += entries.length;
          const folders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); total = folders.length; names = folders.slice(index * 100, (index + 1) * 100);
        }
      } catch (error) {
        if (algorithm !== 'stream' || !['folder_browse_timeout', 'folder_scan_limit', 'folder_browse_busy', 'folder_page_changed'].includes(error?.code)) throw error;
        refusal = error.code; durations.push({ status: 'refused', ms: performance.now() - started }); break;
      }
      durations.push({ status: 'success', ms: performance.now() - started });
      assert.equal(total, profile.directories);
      assert.deepEqual(names, Array.from({ length: 100 }, (_, step) => folderProfileName(index * 100 + step)));
      for (const name of names) digest.update(name + '\n'); completedPages++;
    }
    assert.equal(counts.liveHandles, 0); assert.equal(counts.directoryOpens, counts.directoryCloses);
    if (!refusal) {
      if (algorithm === 'stream') {
        assert.equal(counts.directoryOpens, pages); assert.equal(counts.bufferChecks, pages); assert.equal(counts.stats, pages * 2);
        assert.equal(counts.directoryReads, (profile.directories + profile.files + 1) * pages);
      } else { assert.equal(counts.readdirCalls, pages); assert.equal(counts.returnedDirents, (profile.directories + profile.files) * pages); }
    }
    return { status: refusal ? 'refused' : 'success', refusal, bufferSize, completedPages, durations, digest: digest.digest('hex'), counts,
      rawEntriesPerScan: profile.directories + profile.files, comparatorOmitsProductionGuards: algorithm === 'readdir' };
  };
}
