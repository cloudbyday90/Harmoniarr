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

test('keyboard nested settings navigation loads real lazy children and preserves history without document reload', {
  timeout: config.scenarioTimeoutMs,
}, () => {
  const operation = runtime.runScenario(async ({ baseUrl, page }) => {
    const errors = [];
    const chunks = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const name = new URL(request.url()).pathname.split('/').at(-1);
      if (/^Settings(?:Workspace|Connections|General)View-.*\.js$/u.test(name)) chunks.add(name.split('-')[0]);
    });
    await bootstrapAdminThroughUi(page, { baseUrl });
    await dismissSetupModeIfPresent(page);
    const documentMarker = await page.evaluate(() => {
      globalThis.runtimeDocumentMarker = crypto.randomUUID();
      return globalThis.runtimeDocumentMarker;
    });
    const settings = page.locator('.hx-sidebar').getByRole('link', { name: 'Settings', exact: true });
    await settings.focus();
    assert.equal(await settings.evaluate(element => element === globalThis.document.activeElement), true);
    await settings.press('Enter');
    await page.waitForURL('**/app/settings');
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    const primary = page.getByRole('navigation', { name: 'Settings sections', exact: true });
    const connections = primary.getByRole('link', { name: 'Connections', exact: true });
    await connections.focus();
    assert.equal(await connections.evaluate(element => element === globalThis.document.activeElement), true);
    await connections.press('Enter');
    await page.waitForURL('**/app/settings/connections');
    await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
    assert.equal(await connections.getAttribute('aria-current'), 'page');
    await primary.getByRole('button', { name: 'More settings', exact: true }).click();
    await page.getByRole('navigation', { name: 'More settings sections', exact: true }).getByRole('link', { name: 'System & security', exact: true }).click();
    await page.waitForURL('**/app/settings/system');
    await page.getByRole('heading', { name: 'Security configuration', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).count(), 0);
    await page.goBack();
    await page.waitForURL('**/app/settings/connections');
    await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
    await page.goForward();
    await page.waitForURL('**/app/settings/system');
    await page.getByRole('heading', { name: 'Security configuration', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => globalThis.runtimeDocumentMarker), documentMarker);
    assert.deepEqual([...chunks].sort(), ['SettingsConnectionsView', 'SettingsGeneralView', 'SettingsWorkspaceView']);
    assert.deepEqual(errors, []);
  }, { scenarioName: 'runtime_navigation_contract' });
  active.add(operation);
  operation.then(() => active.delete(operation), () => active.delete(operation));
  return operation;
});
