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
import { getOperatorArtistRevision } from '../../src/client/lib/operator-artist-revision.js';

test('only explicitly loaded no-snapshot maps to zero; malformed or absent snapshots fail closed', () => {
  const projection = (latestSnapshot) => ({ operator: { reconciliation: { latestSnapshot } } });
  assert.equal(getOperatorArtistRevision(projection(null)), 0);
  assert.equal(getOperatorArtistRevision(projection({ snapshotRevision: 0 })), 0);
  assert.equal(getOperatorArtistRevision(projection({ snapshotRevision: 5 })), 5);
  for (const value of [undefined, {}, { snapshotRevision: -1 }, { snapshotRevision: '0' }, { snapshotRevision: 1.5 }]) {
    assert.equal(getOperatorArtistRevision(projection(value)), null);
  }
  assert.equal(getOperatorArtistRevision(null), null);
});
