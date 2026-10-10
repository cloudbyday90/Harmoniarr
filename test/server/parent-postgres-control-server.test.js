/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createParentPostgresControlServer } from '../../testing/integration/parent-postgres-control-server.js';
import { createParentPostgresClient } from '../../testing/integration/parent-postgres-client.js';

test('loopback control rejects unauthenticated, read and malformed requests before dispatch', async () => {
  const calls = []; const token = 'a'.repeat(64);
  const server = await createParentPostgresControlServer({ registry: {
    authenticate: (value) => value === token,
    dispatch: async (value, record) => { calls.push({ value, record }); return { databaseName: 'hx_owned' }; },
  } });
  try {
    assert.equal((await fetch(server.endpoint)).status, 405);
    assert.equal((await fetch(server.endpoint, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(server.endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: '{}' })).status, 400);
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    assert.equal((await fetch(server.endpoint, { method: 'POST', headers, body: '{' })).status, 400);
    await fetch(server.endpoint, { method: 'POST', headers, body: 'x'.repeat(2049) }).catch(() => {});
    assert.equal(calls.length, 0);
    const client = createParentPostgresClient({ env: { HARMONIARR_TEST_PG_MODE: 'parent',
      HARMONIARR_TEST_PG_ENDPOINT: server.endpoint, HARMONIARR_TEST_PG_TOKEN: token } });
    assert.equal(await client.reserve('scenario'), 'hx_owned'); assert.equal(calls.length, 1);
  } finally { await server.close(); }
});
test('control response does not reflect database diagnostics', async () => {
  const server = await createParentPostgresControlServer({ registry: { authenticate: () => true,
    dispatch: async () => { throw new Error('private-dsn-password'); } } });
  try {
    const response = await fetch(server.endpoint, { method: 'POST', headers: {
      authorization: `Bearer ${'b'.repeat(64)}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 400); assert.equal((await response.text()).includes('private-dsn-password'), false);
  } finally { await server.close(); }
});
