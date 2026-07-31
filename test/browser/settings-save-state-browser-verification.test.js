/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
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

suite('Settings save-state browser verification', () => {
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

  test('Settings keeps save retry, provider verification, and saved outcomes distinct', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let rejectNextSave = true;
      let settingsPayload = null;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route('**/api/v1/slskd/status', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            provider: 'slskd',
            status: { provider: 'slskd', status: 'healthy' },
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        if (route.request().method() === 'GET') {
          const response = await route.fetch();
          settingsPayload = await response.json();
          settingsPayload.settings.slskd.providerMode = 'external';
          settingsPayload.secretStatus ??= {};
          settingsPayload.secretStatus.slskd = {
            ...(settingsPayload.secretStatus.slskd ?? {}),
            managedDeploymentDetected: false,
            providerMode: 'external',
            providerModeLocked: false,
            providerModeState: 'external_ready',
          };
          await route.fulfill({
            body: JSON.stringify(settingsPayload),
            contentType: 'application/json',
            response,
          });
          return;
        }

        if (rejectNextSave) {
          rejectNextSave = false;
          await route.fulfill({
            body: JSON.stringify({
              error: {
                code: 'validation_failed',
                message: 'Batch size must be between 1 and 50.',
              },
            }),
            contentType: 'application/json',
            status: 400,
          });
          return;
        }

        const update = route.request().postDataJSON();
        settingsPayload = {
          ...settingsPayload,
          settings: {
            ...settingsPayload.settings,
            ...update,
          },
        };
        await route.fulfill({
          body: JSON.stringify(settingsPayload),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/settings/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Discovery scheduling' }).waitFor();
      await page.getByLabel('Batch size').fill('6');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByRole('alert').filter({ hasText: 'Batch size must be between 1 and 50.' }).waitFor();
      await page.getByRole('heading', { name: 'Discovery scheduling' }).waitFor();
      await page.getByRole('button', { name: 'Try saving again' }).click();
      await page.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor();
      await page.getByRole('button', { name: 'Saved' }).waitFor();

      await page.goto(`${baseUrl}/app/settings/connections`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Soulseek status' }).waitFor();
      await page.getByLabel('Service address').fill('http://slskd:5031');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Saved - test needed', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Test saved connection' }).waitFor();
      assert.equal(
        await page.getByRole('region', { name: 'Soulseek status' })
          .getByRole('button', { name: 'Test saved connection' })
          .count(),
        0,
      );
      await page.getByRole('button', { name: 'Test saved connection' }).click();
      await page.getByRole('region', { name: 'Soulseek status' })
        .getByRole('button', { name: 'Test saved connection' })
        .waitFor();
      assert.equal(await page.locator('[data-save-state="saved_unverified"]').count(), 0);

      await page.goto(`${baseUrl}/app/settings/media-storage`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Media folders' }).waitFor();
      await page.getByRole('heading', { name: 'Folder readiness' }).waitFor();
      await page.getByRole('button', { name: 'Save settings' }).click();
      await page.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Test saved connection' }).count(), 0);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'settings_save_state' });
  });
});
