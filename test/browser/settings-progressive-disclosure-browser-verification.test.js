/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Settings progressive disclosure browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('Settings leads with setup and reveals specialist controls only on request', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            dependencies: [{
              message: 'Soulseek is connected and ready for downloads.',
              provider: 'slskd',
              status: 'healthy',
            }],
          }),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Get Harmoniarr ready' }).waitFor();
      await page.getByText('Connect Soulseek', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Set folders' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'System & security' }).count(), 0);

      const moreSettings = page.getByRole('button', { name: 'More settings' });
      await moreSettings.click();
      await page.getByRole('link', { name: 'System & security' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/connections`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Test Soulseek' }).waitFor();
      const optionalSources = page.getByRole('button', { name: 'Set up optional services' });
      await optionalSources.click();
      await page.getByRole('heading', { name: 'Spotify' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Discovery scheduling' }).waitFor();
      const matchRanking = page.getByRole('button', { name: 'Show match ranking' });
      await matchRanking.click();
      await page.getByLabel('Format tier').waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'settings_progressive_disclosure' });
  });
});
