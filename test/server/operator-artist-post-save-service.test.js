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
import { setImmediate as settle } from 'node:timers/promises';
import { createOperatorArtistPostSaveService } from '../../src/server/metadata/operator-artist-post-save-service.js';

const snapshotId = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';

test('post-save reporting only serializes fixed fields and validated snapshot correlation', async () => {
  const messages = [];
  const service = createOperatorArtistPostSaveService({ reporter: { writeWarning: (message) => messages.push(message) } });
  const secret = 'password=private-token\nforged-log';
  const failure = Object.assign(new Error(secret), { code: secret, details: { secret } });
  assert.equal(await service.run('projection', () => { throw failure; }, { snapshotId, snapshotRevision: 7, secret }), null);
  assert.deepEqual(JSON.parse(messages[0]), {
    event: 'artist_post_save_failed', phase: 'projection', saveCommitted: true,
    snapshotId: snapshotId.toLowerCase(), snapshotRevision: 7,
  });
  await service.run(secret, async () => ({ recorded: false }), { snapshotId: secret, snapshotRevision: secret });
  assert.deepEqual(JSON.parse(messages[1]), {
    event: 'artist_post_save_failed', phase: 'unknown', saveCommitted: true,
    snapshotId: null, snapshotRevision: null,
  });
  assert.ok(!messages.join('').includes('private-token'));
});

test('post-save runner reports explicit degraded outcomes but not successful or coalesced work', async () => {
  const messages = [];
  const service = createOperatorArtistPostSaveService({ reporter: { writeWarning: (message) => messages.push(JSON.parse(message)) } });
  await service.run('policy_activity', async () => ({ recorded: true }));
  await service.run('notification', async () => ({ failed: 0 }));
  await service.run('metadata_refresh', async () => { throw { code: 'metadata_artist_refresh_in_progress' }; });
  assert.equal(messages.length, 0);
  await service.run('policy_activity', async () => ({ recorded: false }));
  await service.run('notification', async () => ({ failed: 2 }));
  await service.run('projection', async () => { throw { code: 'metadata_artist_refresh_in_progress' }; });
  assert.deepEqual(messages.map((item) => item.phase), ['policy_activity', 'notification', 'projection']);
});

test('throwing, rejecting or stalled diagnostic sinks cannot reject or delay committed-save recovery', async () => {
  for (const writeWarning of [
    () => { throw new Error('sink unavailable'); },
    async () => { throw new Error('sink unavailable'); },
    () => new Promise(() => {}),
  ]) {
    const service = createOperatorArtistPostSaveService({ reporter: { writeWarning } });
    assert.equal(await service.run('projection', async () => { throw new Error('unavailable'); }), null);
  }
  await settle();
});
