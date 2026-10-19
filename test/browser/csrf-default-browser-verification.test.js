/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi, dismissSetupModeIfPresent } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const active = new Set();
let runtime;
before(async () => {
  runtime = await createBrowserSmokeRuntime({ config });
}, { timeout: config.suiteSetupTimeoutMs });
after(async () => {
  await Promise.allSettled([...active]);
  await runtime?.cleanup();
}, { timeout: config.suiteTeardownTimeoutMs });

test('default-required settings reject a headerless browser request and save through the actual UI token client', {
  timeout: config.scenarioTimeoutMs,
}, () => {
  const operation = runtime.runScenario(async ({ baseUrl, page, getPoolFn }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await bootstrapAdminThroughUi(page, { baseUrl });
    await dismissSetupModeIfPresent(page);
    await page.goto(`${baseUrl}/app/settings/system`);
    const protection = page.getByLabel('Cross-site request protection', { exact: true });
    await protection.waitFor();
    assert.equal(await protection.inputValue(), 'required');
    const rowsBefore = (await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows;
    const refused = await page.request.put(`${baseUrl}/api/v1/settings`, { data: { system: { logLevel: 'error' } } });
    assert.equal(refused.status(), 403);
    assert.equal((await refused.json()).error.code, 'csrf_required');
    assert.deepEqual((await getPoolFn().query('SELECT * FROM app_settings ORDER BY namespace, setting_key')).rows, rowsBefore);

    await page.getByRole('button', { name: 'Show advanced system controls', exact: true }).click();
    await page.getByLabel('Log level', { exact: true }).selectOption('debug');
    const [saved] = await Promise.all([
      page.waitForResponse(response => (
        new URL(response.url()).pathname === '/api/v1/settings' && response.request().method() === 'PUT'
      )),
      page.getByRole('button', { name: 'Save changes', exact: true }).click(),
    ]);
    assert.equal(saved.status(), 200);
    assert.ok((await saved.request().allHeaders())['x-csrf-token']);
    assert.equal((await saved.json()).settings.security.csrfProtectionMode, 'required');
    const persisted = await getPoolFn().query(`
      SELECT setting_value FROM app_settings WHERE namespace = 'system' AND setting_key = 'logLevel'
    `);
    assert.deepEqual(persisted.rows, [{ setting_value: 'debug' }]);
    assert.deepEqual(errors, []);
  }, { scenarioName: 'csrf_default_browser' });
  active.add(operation);
  operation.then(() => active.delete(operation), () => active.delete(operation));
  return operation;
});
