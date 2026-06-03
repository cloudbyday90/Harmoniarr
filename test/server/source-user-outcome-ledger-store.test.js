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
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';

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

test('appendOutcomeEvent inserts a normalized event with a derived username key', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      id: 'evt-1',
      username_key: 'flac-peer',
      username: 'FLAC-Peer',
      outcome: 'success',
      event_type: 'import_candidate_applied',
      reason: 'Imported cleanly',
      actor_user_id: 'admin-1',
      occurred_at: '2026-06-27T00:00:00.000Z',
      recorded_at: '2026-06-27T00:00:00.500Z',
    }],
  }));
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  const event = await store.appendOutcomeEvent({
    actorUserId: 'admin-1',
    eventType: 'import_candidate_applied',
    occurredAt: '2026-06-27T00:00:00.000Z',
    outcome: 'success',
    reason: 'Imported cleanly',
    username: '  FLAC-Peer  ',
  });

  assert.equal(event.id, 'evt-1');
  assert.equal(event.usernameKey, 'flac-peer');
  assert.equal(event.username, 'FLAC-Peer');
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /INSERT INTO source_user_outcome_events/);
  assert.equal(pool.calls[0].params[0], 'flac-peer');
  assert.equal(pool.calls[0].params[1], 'FLAC-Peer');
  assert.equal(pool.calls[0].params[2], 'success');
  assert.equal(pool.calls[0].params[7], 'admin-1');
});

test('appendOutcomeEvent persists a clamped quality weight and label, defaulting to full quality', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'evt-2', username: 'peer', username_key: 'peer', outcome: 'success', quality_weight: 0.5, quality_label: 'partial_apply' }] }));
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  const event = await store.appendOutcomeEvent({
    outcome: 'success',
    qualityWeight: 0.5,
    qualityLabel: 'partial_apply',
    username: 'peer',
  });

  assert.equal(event.qualityWeight, 0.5);
  assert.equal(event.qualityLabel, 'partial_apply');
  assert.match(pool.calls[0].text, /quality_weight/);
  assert.equal(pool.calls[0].params[3], 0.5);
  assert.equal(pool.calls[0].params[4], 'partial_apply');

  await store.appendOutcomeEvent({ outcome: 'success', qualityWeight: 9, username: 'peer' });
  assert.equal(pool.calls[1].params[3], 1);

  await store.appendOutcomeEvent({ outcome: 'success', username: 'peer' });
  assert.equal(pool.calls[2].params[3], 1);
});

test('appendOutcomeEvent rejects blank usernames and invalid outcomes without querying', async () => {
  const pool = createFakePool();
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  assert.equal(await store.appendOutcomeEvent({ outcome: 'success', username: '   ' }), null);
  assert.equal(await store.appendOutcomeEvent({ outcome: 'maybe', username: 'peer' }), null);
  assert.equal(pool.calls.length, 0);
});

test('listRecentOutcomeEvents filters by username keys, since, and a bounded limit', async () => {
  const pool = createFakePool(() => ({ rows: [] }));
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  await store.listRecentOutcomeEvents({
    usernameKeys: ['FLAC-Peer', 'flac-peer', 'other'],
    since: '2026-06-01T00:00:00.000Z',
    limit: 50,
  });

  const call = pool.calls[0];
  assert.match(call.text, /username_key = ANY\(\$1\)/);
  assert.match(call.text, /occurred_at >= \$2/);
  assert.deepEqual(call.params[0], ['flac-peer', 'other']);
  assert.equal(call.params[1], '2026-06-01T00:00:00.000Z');
  assert.equal(call.params[2], 50);
});

test('listRecentOutcomeEvents short-circuits when given an empty key set', async () => {
  const pool = createFakePool();
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  const events = await store.listRecentOutcomeEvents({ usernameKeys: [] });

  assert.deepEqual(events, []);
  assert.equal(pool.calls.length, 0);
});

test('pruneOutcomeEvents deletes events older than the supplied cutoff', async () => {
  const pool = createFakePool(() => ({ rowCount: 7 }));
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  const result = await store.pruneOutcomeEvents({ olderThan: '2026-01-01T00:00:00.000Z' });

  assert.equal(result.prunedCount, 7);
  assert.match(pool.calls[0].text, /DELETE FROM source_user_outcome_events/);
  assert.equal(pool.calls[0].params[0], '2026-01-01T00:00:00.000Z');
});

test('pruneOutcomeEvents is a no-op without a valid cutoff', async () => {
  const pool = createFakePool();
  const store = createSourceUserOutcomeLedgerStore({ getPoolFn: pool.getPoolFn });

  const result = await store.pruneOutcomeEvents({ olderThan: 'not-a-date' });

  assert.deepEqual(result, { prunedCount: 0 });
  assert.equal(pool.calls.length, 0);
});
