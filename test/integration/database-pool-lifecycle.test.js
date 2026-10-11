/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();

test('shared pool shutdown refuses replacement until its held native client is returned', {
  timeout: config.suiteSetupTimeoutMs + config.scenarioTimeoutMs + config.suiteTeardownTimeoutMs,
}, async () => {
  await withIntegrationApp({
    config,
    createAppFn: () => ({ app: createServer((_request, response) => response.end('ready')) }),
    run: async ({ baseUrl, getPoolFn }) => {
      assert.equal(await (await fetch(baseUrl)).text(), 'ready');
      const pool = getPoolFn();
      const client = await pool.connect();
      let closed = false;
      const closing = closePool();
      void closing.then(() => { closed = true; }, () => {});
      try {
        await Promise.resolve();
        assert.equal(closed, false);
        assert.throws(() => getPool(), { code: 'database_pool_closing' });
        assert.strictEqual(closePool(), closing);
        assert.equal((await client.query('SELECT 1 AS value')).rows[0].value, 1);
      } finally {
        client.release();
        await closing;
        // Also close any replacement created by the rejected baseline assertion.
        await closePool();
      }
      assert.equal(closed, true);
      const restarted = getPool();
      assert.notStrictEqual(restarted, pool);
      assert.equal((await restarted.query('SELECT 2 AS value')).rows[0].value, 2);
    },
  });
});
