/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { drainPostgresFixtureBackends } from '../../testing/integration/postgres-backend-drain.js';

test('database drain verifies zero remaining owned backends and never targets another database', async () => {
  const counts = [2, 1, 0]; const calls = []; let pauses = 0;
  await drainPostgresFixtureBackends({ databaseName: 'owned-fixture', now: () => 0,
    pause: async () => { pauses++; }, adminClient: { query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: /COUNT/u.test(sql) ? [{ active_count: counts.shift() }] : [] };
    } },
  });
  assert.equal(pauses, 2); assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.values.length === 1 && call.values[0] === 'owned-fixture'));
});

test('an unavailable count is a failure with its original error rather than evidence of zero backends', async () => {
  const primary = new Error('Controlled unavailable count');
  await assert.rejects(drainPostgresFixtureBackends({ databaseName: 'owned-fixture', adminClient: {
    query: async () => { throw primary; },
  } }), (error) => error === primary);
});

test('drain timeout while backends remain is explicit and uses its monotonic budget', async () => {
  const ticks = [0, 0, 5000]; const calls = [];
  await assert.rejects(drainPostgresFixtureBackends({ databaseName: 'owned-fixture', now: () => ticks.shift(), pause: async () => {},
    adminClient: { query: async (sql) => { calls.push(sql); return { rows: [{ active_count: 1 }] }; } },
  }), { code: 'fixture_database_drain_incomplete' });
  assert.equal(calls.filter((sql) => /COUNT/u.test(sql)).length, 2);
  assert.equal(calls.filter((sql) => /pg_terminate_backend/u.test(sql)).length, 1);
});

test('missing or malformed count and backwards clocks cannot certify cleanup', async () => {
  for (const active_count of [undefined, null, '0', -1]) {
    await assert.rejects(drainPostgresFixtureBackends({ databaseName: 'owned-fixture',
      adminClient: { query: async () => ({ rows: [{ active_count }] }) },
    }), { code: 'fixture_database_drain_incomplete' });
  }
  const ticks = [20, 10];
  await assert.rejects(drainPostgresFixtureBackends({ databaseName: 'owned-fixture', now: () => ticks.shift(),
    adminClient: { query: async () => ({ rows: [{ active_count: 1 }] }) },
  }), { code: 'fixture_database_drain_incomplete' });
});
