/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prepareDatabase } from '../../src/server/database-preparation.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const active = new Set();
after(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

for (const savedMode of [null, 'disabled', 'required']) {
  test(`native startup preserves legacy ${savedMode ?? 'missing-row'} CSRF intent and protected re-enablement`, {
    timeout: config.scenarioTimeoutMs,
  }, () => {
    const operation = withIntegrationApp({
      config,
      async prepareDatabaseFn(options) {
        const prepared = await prepareDatabase(options);
        const client = await options.getPoolFn().connect();
        try {
          await client.query(`
            INSERT INTO app_settings (namespace, setting_key, setting_value)
            VALUES ('system', 'logLevel', '"warn"'::jsonb)
          `);
          if (savedMode !== null) {
            await client.query(`
              INSERT INTO app_settings (namespace, setting_key, setting_value)
              VALUES ('security', 'csrfProtectionMode', $1::jsonb)
            `, [JSON.stringify(savedMode)]);
          }
        } finally {
          client.release();
        }
        return prepared;
      },
      async run({ client, getPoolFn }) {
        assert.equal((await bootstrapAdminSession(client)).response.status, 201);
        const settings = await client.requestJson('/api/v1/settings');
        assert.equal(settings.payload.settings.security.csrfProtectionMode, savedMode ?? 'required');
        assert.equal(settings.payload.settings.system.logLevel, 'warn');
        const request = { method: 'PUT', csrf: false, json: { system: { logLevel: 'debug' } } };
        const opening = (await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows;
        const result = await client.requestJson('/api/v1/settings', request);
        assert.equal(result.response.status, savedMode === 'disabled' ? 200 : 403);
        if (savedMode !== 'disabled') {
          assert.equal(result.payload.error.code, 'csrf_required');
          assert.deepEqual((await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows, opening);
        }
        const enable = await client.requestJson('/api/v1/settings', {
          method: 'PUT', json: { security: { csrfProtectionMode: 'required' } },
        });
        assert.equal(enable.response.status, 200);
        assert.equal(enable.payload.settings.security.csrfProtectionMode, 'required');
        const enabledRows = (await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows;
        const refused = await client.requestJson('/api/v1/settings', {
          ...request, json: { system: { logLevel: 'error' } },
        });
        assert.equal(refused.response.status, 403);
        assert.equal(refused.payload.error.code, 'csrf_required');
        assert.deepEqual((await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows, enabledRows);
        const persisted = await getPoolFn().query(`
          SELECT setting_value FROM app_settings
          WHERE namespace = 'security' AND setting_key = 'csrfProtectionMode'
        `);
        assert.deepEqual(persisted.rows, [{ setting_value: 'required' }]);
      },
    });
    active.add(operation);
    operation.then(() => active.delete(operation), () => active.delete(operation));
    return operation;
  });
}
