/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, suite, test } from 'node:test';
import { runProviderCollectionAccessValidation } from '../../scripts/validate-provider-collection-access.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const checkPath = '/api/v1/providers/collection-access-check';
const sourceUrl = 'https://www.youtube.com/playlist?list=controlledFixture';
let runtime;
let unavailableReason = null;

suite('provider collection access through PostgreSQL sessions', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('requires fresh admin and CSRF before spending quota, records disabled evidence, and creates no acquisition work', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, client, getPoolFn, workspaceDir }) => {
      const pool = getPoolFn();
      const publicClient = createSessionHttpClient(baseUrl);
      const request = (session = client, overrides = {}) => session.requestJson(checkPath, {
        method: 'POST', json: { sourceUrl }, ...overrides,
      });
      assert.equal((await request(publicClient)).response.status, 401);
      assert.equal((await bootstrapAdminSession(client)).response.status, 201);
      assert.equal((await client.requestJson('/api/v1/settings', {
        method: 'PUT', json: { security: { csrfProtectionMode: 'required' } },
      })).response.status, 200);
      assert.equal((await request(client, { csrf: false })).response.status, 403);
      await pool.query("UPDATE app_users SET role = 'requester' WHERE username = 'admin'");
      assert.equal((await request()).payload.error.code, 'admin_required');
      await pool.query("UPDATE app_users SET role = 'admin', must_change_password = true WHERE username = 'admin'");
      assert.equal((await request()).payload.error.code, 'reauth_required');
      await pool.query("UPDATE app_users SET must_change_password = false WHERE username = 'admin'");
      assert.equal((await client.requestJson('/api/v1/providers/status')).response.status, 200);

      assert.equal((await request(client, { json: { sourceUrl, accessToken: 'must-not-be-accepted' } })).response.status, 400);
      const invalid = await request(client, { json: { sourceUrl: 'https://secret:password@www.youtube.com/playlist?list=controlledFixture' } });
      assert.equal(invalid.response.status, 400);
      assert.equal(JSON.stringify(invalid.payload).includes('password'), false);
      const disabled = await request();
      assert.equal(disabled.response.status, 200);
      assert.equal(disabled.response.headers.get('cache-control'), 'no-store');
      assert.equal(disabled.payload.check.code, 'disabled');
      assert.equal(disabled.payload.check.pagesChecked, 0);
      assert.equal(disabled.payload.check.fullTraversal, false);

      const passwordFile = join(workspaceDir, 'provider-check-password.txt');
      const evidencePath = join(workspaceDir, 'provider-check-evidence.json');
      await writeFile(passwordFile, 'IntegrationPass123!', { mode: 0o600 });
      await assert.rejects(runProviderCollectionAccessValidation({ args: [
        '--live', '--base-url', baseUrl, '--username', 'admin', '--password-file', passwordFile,
        '--source-url', sourceUrl, '--evidence-path', evidencePath,
      ] }), /Safe evidence saved; strict multi-page collection acceptance remains incomplete/);
      const artifact = JSON.parse(await readFile(evidencePath, 'utf8'));
      assert.equal(artifact.acceptancePassed, false);
      assert.equal(artifact.check.code, 'disabled');
      // This exercises the live command against an isolated local fixture application;
      // it is never retained or cited as a real-provider acceptance artifact.
      assert.equal(JSON.stringify(artifact).includes(sourceUrl), false);
      assert.equal(JSON.stringify(artifact).includes('IntegrationPass123!'), false);
      const limited = await request(client, { headers: { 'x-forwarded-for': '192.0.2.8' } });
      assert.equal(limited.response.status, 429);
      assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
      const counts = await pool.query(`SELECT
        (SELECT count(*)::int FROM media_requests) AS requests,
        (SELECT count(*)::int FROM provider_ingest_requests) AS ingestion,
        (SELECT count(*)::int FROM library_external_request_collections) AS collections,
        (SELECT count(*)::int FROM library_discovery_requests) AS discovery`);
      assert.deepEqual(counts.rows[0], { requests: 0, ingestion: 0, collections: 0, discovery: 0 });
    });
  });
});
