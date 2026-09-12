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
import { createOperatorArtistActivityService } from '../../src/server/metadata/operator-artist-activity-service.js';

test('required artist Activity uses the supplied transaction and propagates persistence failures', async () => {
  const writes = [];
  const client = { query: () => {} };
  const failure = new Error('store unavailable');
  const service = createOperatorArtistActivityService({ activityEventStore: { insertActivityEvent: async (event) => {
    writes.push(event);
    if (writes.length === 2) throw failure;
  } } });
  const input = { client, actorUserId: 'actor', artist: { id: 'artist', name: 'Artist' },
    policyChangeSummary: { hasChanges: true, snapshot: { id: 'snapshot' } }, becameMonitored: true, triggerSource: 'save' };
  await assert.rejects(() => service.recordSaveActivity({ ...input, client: null }), /transaction client/);
  assert.equal(writes.length, 0);
  await assert.rejects(() => service.recordSaveActivity(input), failure);
  assert.deepEqual(writes.map((row) => row.eventType), ['artist_policy_saved', 'artist_monitored']);
  assert.ok(writes.every((row) => row.queryable === client && row.actorUserId === 'actor'));
});

test('unchanged artist intent writes no required Activity', async () => {
  const service = createOperatorArtistActivityService({ activityEventStore: {
    insertActivityEvent: async () => { assert.fail('No duplicate Activity for unchanged intent'); },
  } });
  await service.recordSaveActivity({ client: { query: () => {} }, artist: { id: 'artist' },
    policyChangeSummary: { hasChanges: false }, becameMonitored: false });
});
