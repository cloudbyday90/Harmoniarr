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
import { createOperatorArtistSaveStateStore } from '../../src/server/metadata/operator-artist-save-state-store.js';

const store = createOperatorArtistSaveStateStore();
const scope = { appUserId: 'user', metadataArtistId: 'artist' };

test('save revision reads distinguish absent snapshots from PostgreSQL bigint values', async () => {
  for (const [rows, expected] of [[[], 0], [[{ snapshot_revision: '12' }], 12], [[{ snapshot_revision: 2 }], 2]]) {
    const revision = await store.getSnapshotRevision({ ...scope, client: { query: async () => ({ rows }) } });
    assert.equal(revision, expected);
  }
});

test('save revision reads fail closed for malformed or unsafe persisted values', async () => {
  for (const value of [null, undefined, '', '2oops', '1.5', '-1', '9007199254740992', 1.2]) {
    await assert.rejects(store.getSnapshotRevision({
      ...scope, client: { query: async () => ({ rows: [{ snapshot_revision: value }] }) },
    }), /Stored artist snapshot revision is invalid/);
  }
});
