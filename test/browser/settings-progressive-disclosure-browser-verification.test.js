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
            }, {
              message: 'MusicBrainz lookups are reachable.',
              provider: 'musicbrainz',
              status: 'healthy',
            }, {
              message: 'Media inspection tooling is available.',
              provider: 'media_tooling',
              status: 'healthy',
            }],
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.settings.slskd.providerMode = 'managed';
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          managedDeploymentDetected: false,
          providerMode: 'managed',
          providerModeLocked: false,
          providerModeState: 'managed_deployment_missing',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Get Harmoniarr ready' }).waitFor();
      await page.getByText('Connect Soulseek', { exact: true }).waitFor();
      await page.getByText('Managed setup required', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Finish managed setup' }).waitFor();
      await page.getByRole('link', { name: 'Set folders' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'System & security' }).count(), 0);

      const moreSettings = page.getByRole('button', { name: 'More settings' });
      await moreSettings.click();
      await page.getByRole('link', { name: 'System & security' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/connections`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Test saved connection' }).waitFor();
      await page.getByRole('heading', { name: 'Saved connection status' }).waitFor();
      await page.getByText('Soulseek is connected and ready for downloads.', { exact: true }).waitFor();
      const otherServiceStatus = page.getByRole('button', { name: 'Show other service status' });
      await otherServiceStatus.click();
      await page.getByText('MusicBrainz lookups are reachable.', { exact: true }).waitFor();
      await page.getByText('Media inspection tooling is available.', { exact: true }).waitFor();
      await page.getByRole('group', { name: 'Soulseek provider mode' }).waitFor();
      assert.equal(await page.getByRole('radio', { name: /Managed/ }).count(), 1);
      assert.equal(await page.getByRole('radio', { name: /External/ }).count(), 1);
      await page.getByRole('heading', { name: 'Finish managed setup' }).waitFor();
      await page.getByText('slskd_api_key', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Copy command' }).waitFor();
      await page.getByRole('radio', { name: /External/ }).check();
      await page.getByRole('heading', { name: 'Make completed downloads available' }).waitFor();
      await page.getByRole('link', { name: 'Set up folders' }).waitFor();
      await page.getByRole('radio', { name: /Disabled/ }).check();
      assert.equal(await page.getByLabel('Service address').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Soulseek is off' }).isDisabled(), true);
      const optionalSources = page.getByRole('button', { name: 'Set up optional services' });
      await optionalSources.click();
      await page.getByRole('heading', { name: 'Spotify' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/media-storage`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Media folders' }).waitFor();
      await page.getByRole('heading', { name: 'Folder readiness' }).waitFor();
      await page.getByText('Finish automatic download setup', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Add path translation', exact: true }).click();
      await page.getByRole('button', { name: 'Hide path translations', exact: true }).waitFor();
      assert.equal(await page.getByPlaceholder('/data/downloads/complete').inputValue(), '/data/downloads');

      await page.goto(`${baseUrl}/app/settings/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Discovery scheduling' }).waitFor();
      const advancedLibraryControls = page.getByRole('button', { name: 'Show advanced library controls' });
      await advancedLibraryControls.click();
      const matchRanking = page.getByRole('button', { name: 'Show match ranking' });
      await matchRanking.click();
      await page.getByLabel('Format tier').waitFor();

      await page.goto(`${baseUrl}/app/settings/system`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Security configuration' }).waitFor();
      await page.getByRole('heading', { name: 'Remote access protections' }).waitFor();
      await page.getByRole('button', { name: 'Show advanced system controls' }).click();
      await page.getByLabel('Base URL').waitFor();

      await page.goto(`${baseUrl}/app/settings/users`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Account access' }).waitFor();
      await page.getByRole('heading', { name: 'People' }).waitFor();
      await page.getByRole('button', { name: 'Add user' }).click();
      await page.getByLabel('Username').waitFor();
      await page.getByRole('button', { name: 'Manage Plex accounts' }).click();
      await page.getByRole('button', { name: 'Refresh linked-account preview' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/account`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Account safety' }).waitFor();
      await page.getByRole('heading', { name: 'Security tasks' }).waitFor();
      assert.equal(await page.getByLabel('Current password').isVisible(), false);
      await page.getByRole('button', { name: 'Change password' }).click();
      await page.getByLabel('Current password').waitFor();
      await page.getByRole('button', { name: 'Review devices' }).click();
      await page.getByRole('button', { name: 'Refresh devices' }).waitFor();
      await page.getByRole('button', { name: 'Review activity' }).click();
      await page.getByRole('button', { name: 'Refresh activity' }).waitFor();
      await page.getByRole('button', { name: 'Change request preferences' }).click();
      await page.getByLabel('Preferred format').waitFor();

      await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Recovery status' }).waitFor();
      await page.getByRole('heading', { name: 'Recovery tasks' }).waitFor();
      await page.getByRole('button', { name: 'Review backups' }).click();
      await page.getByRole('button', { name: 'Restore a backup' }).click();
      await page.getByRole('button', { name: 'Review maintenance' }).click();
      await page.getByRole('button', { name: 'Open diagnostics' }).click();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'settings_progressive_disclosure' });
  });
});
