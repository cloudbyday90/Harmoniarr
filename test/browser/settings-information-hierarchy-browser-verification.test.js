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

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.locator('html').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth,
    `Expected no horizontal overflow, received ${dimensions.scrollWidth}px for ${dimensions.clientWidth}px viewport.`,
  );
}

suite('Settings information hierarchy browser verification', () => {
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

  test('Settings keeps core setup grouped, advanced work disclosed, and save actions consistent', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let settingsPayload = null;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
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

      await page.goto(`${baseUrl}/app/settings/system`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('group', { name: 'Cookie security' }).waitFor();
      await page.getByRole('button', { name: 'Show advanced system controls' }).click();
      await page.getByRole('heading', { name: 'System controls' }).waitFor();
      await page.getByLabel('Secure cookies').check();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${baseUrl}/app/settings/connections`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('group', { name: 'Soulseek provider mode' }).waitFor();
      await page.getByRole('group', { name: 'External service details' }).waitFor();
      await page.getByRole('button', { name: 'Show connection behavior' }).click();
      await page.getByRole('heading', { name: 'Connection behavior' }).waitFor();
      await page.getByRole('button', { name: 'Set up optional services' }).click();
      await page.getByText('Optional', { exact: true }).first().waitFor();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${baseUrl}/app/settings/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('group', { name: 'Search timing' }).waitFor();
      await page.getByRole('group', { name: 'Search limits' }).waitFor();
      await page.getByRole('group', { name: 'Automatic downloads' }).waitFor();
      await page.getByRole('button', { name: 'Show advanced library controls' }).click();
      await page.getByRole('heading', { name: 'Library controls' }).waitFor();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${baseUrl}/app/settings/media-storage`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('group', { name: 'Required folders' }).waitFor();
      await page.getByRole('heading', { name: 'Folder readiness' }).waitFor();
      await page.getByRole('button', { name: 'Show cover art settings' }).click();
      await page.getByRole('heading', { name: 'Cover art' }).waitFor();
      await assertNoHorizontalOverflow(page);

      await page.setViewportSize({ height: 844, width: 390 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('group', { name: 'Required folders' }).waitFor();
      await assertNoHorizontalOverflow(page);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'settings_information_hierarchy' });
  });
});
