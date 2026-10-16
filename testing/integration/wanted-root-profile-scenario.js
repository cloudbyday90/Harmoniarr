/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { stat } from 'node:fs/promises';
import { seedWantedRootProfile, profileWantedProjection } from './wanted-root-profile-fixture.js';
import { withRollbackFixtureClient } from './fixture-transaction-client.js';
import { assertWantedRootProfileOptions, compareWantedRootProfilePair } from './wanted-root-profile-comparison.js';
import { assertWantedRootProfileAuthority } from './wanted-root-profile-authority.js';

/** Both lanes retain identical seeding, real reads/hashes and private pair assertions. */
export async function exerciseWantedRootProfile({ workspaceDir, signal, mediaProfile = 'sine', receiptCandidates = 1,
  pairs = 1, onSample = async () => {}, onCheckpoint = async () => {} }) {
  assertWantedRootProfileOptions({ profiles: [mediaProfile], receiptCandidates: [receiptCandidates], pairs });
  signal?.throwIfAborted();
  await onCheckpoint({ stage: 'seed', mediaProfile, receipts: receiptCandidates * 2 });
  const c = await seedWantedRootProfile(workspaceDir, { mediaProfile, durationSeconds: mediaProfile === 'noise' ? 30 : 2, receiptCandidates });
  signal?.throwIfAborted();
  const fileSizes = await Promise.all(c.preview.files.map(async file => (await stat(file.libraryTarget.path)).size));
  await withRollbackFixtureClient(c.pool, async client => {
    // Actual apply already hashed the files. Retain timed pairs without redundant warm-ups.
    for (let pair = 0; pair < pairs; pair++) {
      const results = {}; const rows = [];
      for (const useCombinedRootRead of (pair % 2 ? [true, false] : [false, true])) {
        signal?.throwIfAborted();
        await onCheckpoint({ stage: 'sample', mediaProfile, receipts: receiptCandidates * 2, pair,
          mode: useCombinedRootRead ? 'joined' : 'legacy' });
        const result = await profileWantedProjection(client, { useCombinedRootRead, signal });
        results[useCombinedRootRead ? 'joined' : 'legacy'] = result;
        rows.push({ mediaProfile, receipts: receiptCandidates * 2, pair, useCombinedRootRead, fileSizes,
          queryCount: result.queryCount, queryMs: result.queryMs, counters: result.diagnostics.counters, phases: result.diagnostics.phases });
      }
      compareWantedRootProfilePair(results, { receiptCandidates, fileSizes });
      signal?.throwIfAborted();
      for (const row of rows) { await onSample(row); signal?.throwIfAborted(); }
    }
  });
  signal?.throwIfAborted();
  if (receiptCandidates === 1 && mediaProfile === 'sine') await assertWantedRootProfileAuthority(c);
  signal?.throwIfAborted();
}
