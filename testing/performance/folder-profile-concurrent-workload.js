/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createFolderProfileGroup, verifyFolderProfilePage, verifyFolderProfileRetirement } from './folder-profile-group.js';

const refusals = new Set(['folder_browse_timeout', 'folder_scan_limit', 'folder_browse_busy', 'folder_page_changed']);

export function createConcurrentFolderProfileWorkload(options) {
  return async () => {
    const group = createFolderProfileGroup(options);
    let refused = false;
    try {
      await group.run(async () => { await group.waitForReads(); group.releaseReads(); await Promise.all(group.tasks); });
    } catch (error) {
      if (!refusals.has(error?.code)) throw error;
      refused = true;
    }
    const outcomes = await group.settled;
    const digests = [], refusalCodes = [];
    for (const row of outcomes) {
      if (row.status === 'fulfilled') digests.push(verifyFolderProfilePage(row.value));
      else {
        if (!refusals.has(row.reason?.code)) throw row.reason;
        refusalCodes.push(row.reason.code);
      }
    }
    verifyFolderProfileRetirement(group.counts, !refused);
    if (!refused) {
      assert.equal(digests.length, 4); assert.equal(new Set(digests).size, 1);
      assert.equal(group.counts.directoryOpens, 4); assert.equal(group.counts.stats, 8);
      assert.equal(group.counts.directoryReads, 200_004);
    }
    return { status: refused ? 'refused' : 'success', bufferSize: options.bufferSize, concurrency: 4,
      completedScans: digests.length, refusalCodes, digests, counts: group.counts, rawEntriesPerScan: 50_000 };
  };
}

/** Barrier controls are separate from the throughput/memory samples. */
export async function runConcurrentFolderProfileControls(options) {
  const group = createFolderProfileGroup({ ...options, holdCloses: true });
  return group.run(async () => {
    const assertBusy = async () => {
      const before = { ...group.counts };
      await assert.rejects(group.browse(), error => error?.code === 'folder_browse_busy');
      assert.deepEqual(group.counts, before);
    };
    await group.waitForReads();
    assert.equal(group.counts.liveHandles, 4); await assertBusy();
    group.controllers[0].abort();
    group.releaseReads(); await group.waitForCloses();
    assert.equal(group.counts.liveHandles, 4); assert.equal(group.counts.closeDispatches, 0);
    await assertBusy(); group.controllers[1].abort();
    group.releaseCloses();
    const outcomes = await group.settled;
    assert.deepEqual(outcomes.map(row => row.status), ['rejected', 'rejected', 'fulfilled', 'fulfilled']);
    for (const row of outcomes.slice(0, 2)) assert.equal(row.reason?.name, 'AbortError');
    const digests = outcomes.slice(2).map(row => verifyFolderProfilePage(row.value));
    verifyFolderProfileRetirement(group.counts);
    assert.equal(group.counts.directoryOpens, 4);
    const resumedDigest = verifyFolderProfilePage(await group.browse());
    assert.ok(digests.every(digest => digest === resumedDigest));
    verifyFolderProfileRetirement(group.counts); assert.equal(group.counts.directoryOpens, 5);
    return { bufferSize: options.bufferSize, busyBeforeReadRelease: true, busyBeforeNativeClose: true,
      readAbortBoundary: 'native-read-dispatched-delivery-held', closeAbortBoundary: 'before-native-close-dispatch',
      abortedScans: 2, publishedScans: 2, resumedScan: true, digest: resumedDigest, counts: group.counts };
  });
}
