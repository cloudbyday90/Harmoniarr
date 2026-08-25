/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSharedRecoveryDownloaderMusicQueueLinkage } from '../../testing/docker/controlled-provider-music-queue-linkage-verifier.mjs';

const sharedSeed = {
  privatePolicyMarkers: ['policy-one', 'policy-two'],
  wantedReleases: [
    { appUserId: 'operator-one', wantedReleaseId: 'wanted-one' },
    { appUserId: 'operator-two', wantedReleaseId: 'wanted-two' },
  ],
};

function buildQueue(wantedReleaseId) {
  return {
    transfers: [{
      diagnostics: {
        importLinkage: {
          candidateId: 'fallback-candidate',
          musicQueueRelease: { wantedReleaseId },
          status: 'linked',
        },
      },
    }],
  };
}

test('shared recovery linkage verifier requires each operator scoped Downloader link', async () => {
  const result = await assertSharedRecoveryDownloaderMusicQueueLinkage({
    buildDownloaderQueue: async ({ appUserId }) => buildQueue(
      appUserId === 'operator-one' ? 'wanted-one' : 'wanted-two',
    ),
    fallbackCandidateId: 'fallback-candidate',
    sharedSeed,
  });

  assert.deepEqual(result, {
    linkedTransferCount: 2,
    operatorCount: 2,
    operatorIdentityRedacted: true,
    privatePolicyRedacted: true,
    siblingReleaseRedacted: true,
  });
});

test('shared recovery linkage verifier rejects sibling Music Queue leakage', async () => {
  await assert.rejects(
    () => assertSharedRecoveryDownloaderMusicQueueLinkage({
      buildDownloaderQueue: async () => buildQueue('wanted-one'),
      fallbackCandidateId: 'fallback-candidate',
      sharedSeed,
    }),
    /current operator's Music Queue release/u,
  );
});
