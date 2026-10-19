/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;

suite('Reviewed PostgreSQL query and serialization contracts', () => {
  before(async t => { runtime = await createPostgresIntegrationRuntime({ config, env: {}, signal: t.signal }); },
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('native callback and promise binds preserve mixed values and the caller query configuration', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      const client = await getPoolFn().connect();
      try {
        // Exceed the serializer's initial buffer and mix text/binary/null formats.
        const text = 'music-\u266b'.repeat(1024); const bytes = Buffer.from([0, 255, 3, 128]);
        const values = Object.freeze([text, bytes, null, ['a', '\u266b'], new Date('2026-10-19T12:00:00Z')]);
        const query = { text: 'SELECT $1::text AS title, $2::bytea AS bytes, $3::text AS missing, $4::text[] AS labels, $5::timestamptz AS recorded',
          rowMode: 'array' };
        const descriptors = Object.getOwnPropertyDescriptors(query);
        const expected = [text, bytes, null, ['a', '\u266b'], values[4]];
        const callback = await new Promise((resolve, reject) => {
          client.query(query, values, (error, result) => { if (error) reject(error); else resolve(result); });
        });
        assert.deepEqual(callback.rows, [expected]);
        assert.deepEqual(Object.getOwnPropertyDescriptors(query), descriptors);
        const promise = await client.query(query, values);
        assert.deepEqual(promise.rows, [expected]);
        assert.deepEqual(Object.getOwnPropertyDescriptors(query), descriptors);
        assert.equal(client.connection._ending, false);
      } finally { client.release(); }
    }, { signal: t.signal });
  });

  test('a native named empty statement can be executed repeatedly before ordinary parameterized work', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      const client = await getPoolFn().connect();
      try {
        const query = Object.freeze({ name: 'reviewed_empty_statement', text: '', queryMode: 'extended' });
        for (let index = 0; index < 2; index++) {
          const result = await client.query(query);
          assert.deepEqual(result.rows, []);
          assert.equal(result.command, null);
          assert.equal(client.connection._ending, false);
        }
        const result = await client.query('SELECT $1::int AS answer', [42]);
        assert.deepEqual(result.rows, [{ answer: 42 }]);
      } finally { client.release(); }
    }, { signal: t.signal });
  });
});
