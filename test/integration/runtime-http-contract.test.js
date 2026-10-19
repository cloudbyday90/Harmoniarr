/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const active = new Set();
let runtime;

before(async () => {
  runtime = await createIntegrationAppRuntime({ config });
}, { timeout: config.suiteSetupTimeoutMs });

after(async () => {
  await Promise.allSettled([...active]);
  await runtime?.cleanup();
}, { timeout: config.suiteTeardownTimeoutMs });

function scenario(run) {
  const operation = runtime.runScenario(run, { scenarioName: 'runtime_http_contract' });
  active.add(operation);
  operation.then(() => active.delete(operation), () => active.delete(operation));
  return operation;
}

async function readSettingsRows(getPoolFn) {
  return (await getPoolFn().query(`
    SELECT namespace, setting_key, setting_value
    FROM app_settings ORDER BY namespace, setting_key
  `)).rows;
}

const patch = { system: { logLevel: 'debug' } };

async function requireCsrfProtection(client) {
  const configured = await client.requestJson('/api/v1/settings', {
    method: 'PUT', json: { security: { csrfProtectionMode: 'required' } },
  });
  assert.equal(configured.response.status, 200);
  assert.equal(configured.payload.settings.security.csrfProtectionMode, 'required');
}

test('native default settings mutations reject anonymous callers and invalid CSRF without durable changes', {
  timeout: config.scenarioTimeoutMs,
}, () => scenario(async ({ client, getPoolFn }) => {
  const beforeRows = await readSettingsRows(getPoolFn);
  const anonymous = await client.requestJson('/api/v1/settings', { method: 'PUT', json: patch });
  assert.equal(anonymous.response.status, 401);
  assert.equal(anonymous.payload.error.code, 'auth_required');
  assert.deepEqual(await readSettingsRows(getPoolFn), beforeRows);
  assert.equal((await bootstrapAdminSession(client)).response.status, 201);
  const protectedRows = await readSettingsRows(getPoolFn);
  for (const headers of [{}, { 'x-csrf-token': 'deliberately-invalid' }]) {
    const response = await client.requestJson('/api/v1/settings', { method: 'PUT', json: patch, csrf: false, headers });
    assert.equal(response.response.status, 403);
    assert.equal(response.payload.error.code, headers['x-csrf-token'] ? 'csrf_invalid' : 'csrf_required');
    assert.deepEqual(await readSettingsRows(getPoolFn), protectedRows);
  }
  const valid = await client.requestJson('/api/v1/settings', { method: 'PUT', json: patch });
  assert.equal(valid.response.status, 200);
  assert.equal(valid.payload.settings.system.logLevel, 'debug');
  assert.equal(valid.payload.settings.security.csrfProtectionMode, 'required');
  assert.deepEqual(await readSettingsRows(getPoolFn), [
    ...protectedRows, { namespace: 'system', setting_key: 'logLevel', setting_value: 'debug' },
  ]);
}));

test('native default protection preserves public login and refresh while refusing logout without its session token', {
  timeout: config.scenarioTimeoutMs,
}, () => scenario(async ({ baseUrl, client, getPoolFn }) => {
  assert.equal((await bootstrapAdminSession(client)).response.status, 201);
  const rowsBefore = await getPoolFn().query('SELECT id FROM refresh_tokens WHERE is_revoked = FALSE');
  const deniedLogout = await client.requestJson('/api/v1/auth/logout', { method: 'POST', csrf: false });
  assert.equal(deniedLogout.response.status, 403);
  assert.equal(deniedLogout.payload.error.code, 'csrf_required');
  assert.deepEqual((await getPoolFn().query('SELECT id FROM refresh_tokens WHERE is_revoked = FALSE')).rows, rowsBefore.rows);

  const oldToken = client.getCsrfToken();
  const refresh = await client.requestJson('/api/v1/auth/refresh', { method: 'POST', csrf: false });
  assert.equal(refresh.response.status, 200);
  assert.notEqual(client.getCsrfToken(), oldToken);
  const stale = await client.requestJson('/api/v1/settings', {
    method: 'PUT', csrf: false, headers: { 'x-csrf-token': oldToken }, json: patch,
  });
  assert.equal(stale.response.status, 403);
  assert.equal(stale.payload.error.code, 'csrf_invalid');
  assert.deepEqual(await readSettingsRows(getPoolFn), []);

  const second = createSessionHttpClient(baseUrl);
  const login = await second.requestJson('/api/v1/auth/login', {
    method: 'POST', csrf: false, json: { username: 'admin', password: 'IntegrationPass123!' },
  });
  assert.equal(login.response.status, 200);
  const otherSessionToken = await client.requestJson('/api/v1/settings', {
    method: 'PUT', csrf: false, headers: { 'x-csrf-token': second.getCsrfToken() }, json: patch,
  });
  assert.equal(otherSessionToken.response.status, 403);
  assert.equal(otherSessionToken.payload.error.code, 'csrf_invalid');
  assert.deepEqual(await readSettingsRows(getPoolFn), []);
  assert.equal((await client.requestJson('/api/v1/auth/logout', { method: 'POST' })).response.status, 200);
}));

test('native current role is rechecked before an issued session can mutate admin settings', {
  timeout: config.scenarioTimeoutMs,
}, () => scenario(async ({ client, getPoolFn }) => {
  const admin = await bootstrapAdminSession(client);
  assert.equal(admin.response.status, 201);
  await requireCsrfProtection(client);
  const protectedRows = await readSettingsRows(getPoolFn);
  await getPoolFn().query("UPDATE app_users SET role = 'requester' WHERE id = $1", [admin.payload.user.id]);
  const denied = await client.requestJson('/api/v1/settings', { method: 'PUT', json: patch });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.payload.error.code, 'admin_required');
  assert.deepEqual(await readSettingsRows(getPoolFn), protectedRows);
}));

test('native revoked sessions cannot replay a previous cookie and CSRF token into a settings write', {
  timeout: config.scenarioTimeoutMs,
}, () => scenario(async ({ baseUrl, client, getPoolFn }) => {
  assert.equal((await bootstrapAdminSession(client)).response.status, 201);
  await requireCsrfProtection(client);
  const protectedRows = await readSettingsRows(getPoolFn);
  const cookie = client.getCookieHeader();
  const token = client.getCsrfToken();
  assert.equal((await client.requestJson('/api/v1/auth/logout', { method: 'POST' })).response.status, 200);
  const replay = createSessionHttpClient(baseUrl);
  const denied = await replay.requestJson('/api/v1/settings', { method: 'PUT', json: patch, csrf: false,
    headers: { cookie, 'x-csrf-token': token } });
  assert.equal(denied.response.status, 401);
  assert.equal(denied.payload.error.code, 'auth_required');
  assert.deepEqual(await readSettingsRows(getPoolFn), protectedRows);
}));
