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
import { createSourceUserIgnoreStore } from '../../src/server/activity/source-user-ignore-store.js';

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ params, text });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('listIgnoredUsernames returns the persisted usernames', async () => {
  const pool = createFakePool(() => ({ rows: [{ username: 'Bad-Peer' }, { username: 'Other' }] }));
  const store = createSourceUserIgnoreStore({ getPoolFn: pool.getPoolFn });

  assert.deepEqual(await store.listIgnoredUsernames(), ['Bad-Peer', 'Other']);
});

test('upsertIgnoreEntry inserts a manual entry keyed by a normalized username key', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      id: 'ign-1',
      username_key: 'bad-peer',
      username: 'Bad-Peer',
      source: 'manual',
      reason: 'too many failures',
      actor_user_id: 'admin-1',
      created_at: '2026-06-28T00:00:00.000Z',
      updated_at: '2026-06-28T00:00:00.000Z',
    }],
  }));
  const store = createSourceUserIgnoreStore({ getPoolFn: pool.getPoolFn });

  const entry = await store.upsertIgnoreEntry({
    actorUserId: 'admin-1',
    reason: 'too many failures',
    source: 'manual',
    username: '  Bad-Peer ',
  });

  assert.equal(entry.usernameKey, 'bad-peer');
  assert.equal(entry.source, 'manual');
  assert.match(pool.calls[0].text, /INSERT INTO source_user_ignore_entries/);
  assert.match(pool.calls[0].text, /ON CONFLICT \(username_key\) DO UPDATE/);
  assert.equal(pool.calls[0].params[0], 'bad-peer');
  assert.equal(pool.calls[0].params[2], 'manual');
  assert.equal(pool.calls[0].params[6], null); // last_auto_evaluated_at null for manual
});

test('upsertIgnoreEntry stamps last_auto_evaluated_at for auto_suggested entries', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'ign-2', username: 'p', username_key: 'p', source: 'auto_suggested' }] }));
  const store = createSourceUserIgnoreStore({ getPoolFn: pool.getPoolFn });

  await store.upsertIgnoreEntry({ source: 'auto_suggested', username: 'p', suggestionSignals: { sampleSize: 5 } });

  assert.notEqual(pool.calls[0].params[6], null);
  assert.equal(pool.calls[0].params[5], JSON.stringify({ sampleSize: 5 }));
});

test('upsertIgnoreEntry rejects blank usernames without querying', async () => {
  const pool = createFakePool();
  const store = createSourceUserIgnoreStore({ getPoolFn: pool.getPoolFn });

  assert.equal(await store.upsertIgnoreEntry({ username: '   ' }), null);
  assert.equal(pool.calls.length, 0);
});

test('removeIgnoreEntry deletes by username key and reports the removed count', async () => {
  const pool = createFakePool(() => ({ rowCount: 1 }));
  const store = createSourceUserIgnoreStore({ getPoolFn: pool.getPoolFn });

  const result = await store.removeIgnoreEntry({ username: 'Bad-Peer' });

  assert.deepEqual(result, { removedCount: 1 });
  assert.match(pool.calls[0].text, /DELETE FROM source_user_ignore_entries/);
  assert.equal(pool.calls[0].params[0], 'bad-peer');
});
