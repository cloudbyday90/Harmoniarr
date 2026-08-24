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
import { createImportCandidateMusicQueueSelectionGuard } from '../../src/server/import-candidates/import-candidate-music-queue-selection-guard.js';

test('Music Queue selection guard locks the shared discovery request before finding an active candidate', async (t) => {
  let queryCount = 0;
  const client = {
    query: t.mock.fn(async () => {
      queryCount += 1;
      if (queryCount === 1) {
        return { rows: [{ id: 'discovery-request-1' }] };
      }
      return { rows: [{ id: 'candidate-2', status: 'downloading' }] };
    }),
  };
  const guard = createImportCandidateMusicQueueSelectionGuard();

  const activeCandidate = await guard.findActiveSelection({
    candidate: {
      id: '00000000-0000-0000-0000-000000000001',
      sourceSearchId: 'search-1',
    },
    client,
  });

  assert.deepEqual(activeCandidate, {
    id: 'candidate-2',
    status: 'downloading',
  });
  assert.match(client.query.mock.calls[0].arguments[0], /FOR UPDATE/);
  assert.deepEqual(client.query.mock.calls[0].arguments[1], ['search-1']);
  assert.match(client.query.mock.calls[1].arguments[0], /status = ANY\(\$3::text\[\]\)/);
  assert.deepEqual(client.query.mock.calls[1].arguments[1], [
    'search-1',
    '00000000-0000-0000-0000-000000000001',
    ['selected', 'downloading', 'import_pending'],
  ]);
});

test('Music Queue selection guard leaves candidates outside a current shared discovery request unscoped', async (t) => {
  const client = {
    query: t.mock.fn(async () => ({ rows: [] })),
  };
  const guard = createImportCandidateMusicQueueSelectionGuard();

  const activeCandidate = await guard.findActiveSelection({
    candidate: {
      id: '00000000-0000-0000-0000-000000000001',
      sourceSearchId: 'manual-search-1',
    },
    client,
  });

  assert.equal(activeCandidate, null);
  assert.equal(client.query.mock.callCount(), 1);
});
