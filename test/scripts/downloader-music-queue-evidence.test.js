/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertMusicQueueTransferLinkagePreserved,
  summarizeMusicQueueTransferLinkage,
} from '../../scripts/downloader-music-queue-evidence.js';

function createQueue(transfers) {
  return {
    downloader: {
      transfers,
    },
  };
}

function createLinkedTransfer({ id = 'transfer-1', sourceUser = 'source-one' } = {}) {
  return {
    diagnostics: {
      importLinkage: {
        musicQueueRelease: {
          wantedReleaseId: 'wanted-release-1',
        },
      },
    },
    id,
    sourceUser,
    transferKey: `${sourceUser}::${id}`,
  };
}

test('summarizeMusicQueueTransferLinkage emits only bounded linkage counts', () => {
  const summary = summarizeMusicQueueTransferLinkage(createQueue([
    createLinkedTransfer(),
    {
      diagnostics: {
        importLinkage: {},
      },
      id: 'transfer-2',
      sourceUser: 'source-two',
      transferKey: 'source-two::transfer-2',
    },
  ]));

  assert.deepEqual(summary, {
    linkedTransferCount: 1,
    totalTransferCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(summary), /wanted-release-1|source-one|transfer-1/u);
});

test('assertMusicQueueTransferLinkagePreserved requires every linked transfer to remain linked after refresh', () => {
  const beforeRefresh = createQueue([createLinkedTransfer(), createLinkedTransfer({ id: 'transfer-2' })]);
  const afterRefresh = createQueue([createLinkedTransfer(), createLinkedTransfer({ id: 'transfer-2' })]);

  assert.deepEqual(assertMusicQueueTransferLinkagePreserved({ afterRefresh, beforeRefresh }), {
    afterRefresh: {
      linkedTransferCount: 2,
      totalTransferCount: 2,
    },
    beforeRefresh: {
      linkedTransferCount: 2,
      totalTransferCount: 2,
    },
  });
});

test('assertMusicQueueTransferLinkagePreserved rejects a missing or unlinked prior transfer', () => {
  const beforeRefresh = createQueue([createLinkedTransfer()]);

  assert.throws(
    () => assertMusicQueueTransferLinkagePreserved({ afterRefresh: createQueue([]), beforeRefresh }),
    /1 linked transfer disappeared/u,
  );
  assert.throws(
    () => assertMusicQueueTransferLinkagePreserved({ afterRefresh: createQueue([]), beforeRefresh: createQueue([]) }),
    /Expected at least one Downloader transfer linked to Music Queue/u,
  );
});
