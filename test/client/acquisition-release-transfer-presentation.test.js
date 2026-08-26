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
import { buildAcquisitionReleaseTransferProgress } from '../../src/client/lib/acquisition-release-transfer-presentation.js';

function createTransfer({
  stateCode = 'active',
  wantedReleaseId = 'wanted-forest-frank',
  withLinkage = true,
} = {}) {
  return {
    diagnostics: withLinkage
      ? {
        importLinkage: {
          musicQueueRelease: {
            artistName: 'Forest Frank',
            releaseTitle: 'Child of God',
            wantedReleaseId,
          },
        },
      }
      : undefined,
    filename: '/downloads/Child of God.flac',
    id: `transfer-${stateCode}`,
    sourceUser: 'provider-user',
    state: { code: stateCode },
  };
}

test('Acquisition release transfer progress groups only live transfers by durable wanted-release ID', () => {
  const result = buildAcquisitionReleaseTransferProgress({
    transfers: [
      createTransfer({ stateCode: 'active' }),
      createTransfer({ stateCode: 'queued' }),
      createTransfer({ stateCode: 'completed' }),
      createTransfer({ wantedReleaseId: 'wanted-unlinked', withLinkage: false }),
    ],
  });

  assert.deepEqual(result, {
    'wanted-forest-frank': {
      activeCount: 1,
      handoff: {
        accessibleLabel: 'View download progress for Forest Frank — Child of God',
        description: 'View the live transfer and its controls in Downloader. Release decisions remain in Music Queue.',
        label: 'View download progress',
        location: {
          name: 'downloader',
          query: { wantedReleaseId: 'wanted-forest-frank' },
        },
        wantedReleaseId: 'wanted-forest-frank',
      },
      queuedCount: 1,
      summary: '1 transfer is downloading; 1 transfer is waiting',
      transferCount: 2,
      wantedReleaseId: 'wanted-forest-frank',
    },
  });
});

test('Acquisition release transfer progress never falls back to filename or provider identity', () => {
  const result = buildAcquisitionReleaseTransferProgress({
    transfers: [
      createTransfer({ withLinkage: false }),
      {
        filename: '/downloads/Child of God.flac',
        id: 'same-filename',
        sourceUser: 'another-provider-user',
        state: { code: 'active' },
      },
    ],
  });

  assert.deepEqual(result, {});
});
