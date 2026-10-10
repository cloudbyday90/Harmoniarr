/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createParentPostgresClient } from '../../testing/integration/parent-postgres-client.js';

const env = { HARMONIARR_TEST_PG_MODE: 'parent', HARMONIARR_TEST_PG_ENDPOINT: 'http://127.0.0.1:1234/fixture-database',
  HARMONIARR_TEST_PG_TOKEN: 'a'.repeat(64) };
test('absent parent configuration preserves legacy mode while incomplete or nonlocal configuration refuses', () => {
  assert.equal(createParentPostgresClient({ env: {} }), null);
  for (const input of [{ HARMONIARR_TEST_PG_MODE: 'parent' }, { ...env, HARMONIARR_TEST_PG_TOKEN: '' },
    { ...env, HARMONIARR_TEST_PG_ENDPOINT: 'https://example.com/fixture-database' },
    { ...env, HARMONIARR_TEST_PG_ENDPOINT: 'http://user:secret@127.0.0.1:1234/fixture-database' }]) {
    assert.throws(() => createParentPostgresClient({ env: input }), { code: 'fixture_parent_configuration_invalid' });
  }
});
test('parent client authenticates bounded structured records and carries worker identity', async () => {
  const records = [];
  const client = createParentPostgresClient({ env, pid: 123, fetchFn: async (url, options) => {
    records.push({ url, ...options });
    const record = JSON.parse(options.body);
    const result = record.action === 'reserve' ? { databaseName: 'hx_owned' }
      : ['commit', 'assert'].includes(record.action) ? { databaseName: record.databaseName, oid: record.oid }
        : record.action === 'release' ? { released: true } : { abandoned: true };
    return Response.json({ version: 1, ok: true, result });
  } });
  assert.equal(await client.reserve('scenario'), 'hx_owned');
  await client.commit('hx_owned', '42'); await client.assertOwned('hx_owned', '42');
  await client.release('hx_owned', '42'); await client.abandon('hx_owned');
  assert.deepEqual(records.map((record) => JSON.parse(record.body).action), ['reserve', 'commit', 'assert', 'release', 'abandon']);
  assert.equal(records[0].headers.authorization, `Bearer ${'a'.repeat(64)}`);
  assert.deepEqual(JSON.parse(records[0].body), { version: 1, action: 'reserve', pid: 123, kind: 'scenario' });
});
test('missing or mismatched acknowledgements refuse authorization to use or clean up the database', async () => {
  for (const result of [undefined, {}, { databaseName: 'other', oid: '42' }, { databaseName: 'hx_owned', oid: '43' }]) {
    const client = createParentPostgresClient({ env, fetchFn: async () => Response.json({ version: 1, ok: true, result }) });
    for (const action of ['commit', 'assertOwned', 'release', 'abandon']) {
      await assert.rejects(client[action]('hx_owned', '42'), { code: 'fixture_parent_transport_failed' });
    }
  }
});
test('malformed, oversized and network responses become fixed errors without reflecting secrets', async () => {
  for (const fetchFn of [async () => new Response('x'.repeat(4097)), async () => new Response('private-password'),
    async () => Response.json({ version: 1, ok: true, result: { databaseName: 'unsafe; sql' } }),
    async () => { throw new Error('private-password'); }]) {
    await assert.rejects(createParentPostgresClient({ env, fetchFn }).reserve('scenario'), (error) =>
      error.code === 'fixture_parent_transport_failed' && !error.message.includes('private-password'));
  }
});
