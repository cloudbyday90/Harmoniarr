/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

test('Recovery announces bounded startup progress and held outcomes without moving refresh focus', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl });
    const started = Promise.withResolvers(), release = Promise.withResolvers();
    let state = 'pending', requests = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await browserContext.route('**/api/v1/recovery/backups', async route => {
      requests++;
      if (requests === 1) { started.resolve(); await release.promise; }
      await route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({
          ok: true, backupArtifacts: [],
          backupRecovery: { state, admissionState: 'queued', runId: '00000000-0000-4000-8000-000000000001', unfinishedCount: 4, confirmationCount: 1 }
        })
      });
    });
    try {
      await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' });
      await started.promise;
      const panel = page.getByRole('region', { name: 'Startup backup recovery', exact: true });
      const status = panel.getByRole('status');
      await status.filter({ hasText: 'Checking startup' }).waitFor();
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      release.resolve();
      await status.filter({ hasText: 'queued or paused' }).waitFor();
      const refresh = page.getByRole('button', { name: 'Refresh status', exact: true });
      state = 'completed'; await refresh.click();
      await status.filter({ hasText: 'Some operations remain unresolved' }).waitFor();
      assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
      assert.match(await panel.getByRole('link', { name: 'View backup recovery job' }).getAttribute('href'), /00000000-0000-4000-8000-000000000001/u);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.deepEqual(errors, []);
    } finally { release.resolve(); }
  }, { scenarioName: 'backup_startup_recovery' });
  });
