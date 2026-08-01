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

suite('Settings setup readiness landing browser verification', () => {
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

  test('Settings prioritizes the next repair without exposing setup details or turning every status into a button', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let connectionStatusRequests = 0;
      let settingsRequests = 0;
      let foldersAreReady = false;
      let delayStatusCheck = false;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route('**/api/v1/slskd/status', async (route) => {
        connectionStatusRequests += 1;
        if (delayStatusCheck) {
          await new Promise((resolve) => {
            setTimeout(resolve, 120);
          });
        }

        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            provider: 'slskd',
            status: {
              provider: 'slskd',
              status: 'healthy',
            },
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        settingsRequests += 1;
        const response = await route.fetch();
        const payload = await response.json();
        payload.settings.slskd.providerMode = 'external';
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeLocked: false,
          providerModeState: null,
        };
        payload.settings.paths = {
          ...(payload.settings.paths ?? {}),
          downloads: foldersAreReady ? '/private/downloads' : '',
          music: '/private/music',
        };
        payload.pathValidation = {
          ...(payload.pathValidation ?? {}),
          summary: {
            status: foldersAreReady ? 'healthy' : 'unavailable',
          },
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Setup readiness' }).waitFor();
      await page.locator('.settings-setup-next-action').getByRole('heading', { name: 'Set your folders' }).waitFor();
      assert.equal(await page.getByText('1 required setup task remains before Harmoniarr can download music.', { exact: true }).count(), 0);
      assert.equal(await page.getByText('/private/downloads', { exact: true }).count(), 0);
      assert.equal(await page.getByText('/private/music', { exact: true }).count(), 0);

      const nextAction = page.locator('.settings-setup-next-action');
      await nextAction.getByRole('heading', { name: 'Set your folders' }).waitFor();
      await nextAction.getByRole('link', { name: 'Set folders' }).click();
      await page.waitForURL('**/app/settings/media-storage');

      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      const requiredTasks = page.getByRole('list', { name: 'Required setup tasks' });
      await requiredTasks.locator('a[href="/app/settings/media-storage"]').waitFor();
      assert.equal(await requiredTasks.getByRole('button').count(), 0);
      assert.equal(await page.getByRole('heading', { name: 'Library preferences' }).count(), 1);
      assert.equal(await page.getByText('Choose library behavior', { exact: true }).isVisible(), false);
      await page.getByRole('button', { name: 'Review optional setup' }).click();
      await page.getByText('Choose library behavior', { exact: true }).waitFor();

      foldersAreReady = true;
      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Required setup is complete. Harmoniarr is ready to handle music automatically.', { exact: true }).waitFor();
      assert.equal(await page.locator('.settings-setup-next-action').count(), 0);
      assert.equal(await page.locator('.settings-setup__readiness').count(), 0);

      delayStatusCheck = true;
      const connectionRequestsBeforeRefresh = connectionStatusRequests;
      const settingsRequestsBeforeRefresh = settingsRequests;
      await page.getByRole('button', { name: 'Check status' }).click();
      await page.getByRole('button', { name: 'Checking status' }).waitFor();
      await page.getByRole('button', { name: 'Check status' }).waitFor();
      assert.equal(connectionStatusRequests, connectionRequestsBeforeRefresh + 1);
      assert.equal(settingsRequests, settingsRequestsBeforeRefresh + 1);

      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Setup readiness' }).waitFor();
      const layout = await page.evaluate(() => ({
        clientWidth: globalThis.document.documentElement.clientWidth,
        scrollWidth: globalThis.document.documentElement.scrollWidth,
      }));
      assert.ok(layout.scrollWidth <= layout.clientWidth, `Settings Setup overflows at mobile width: ${JSON.stringify(layout)}`);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'settings_setup_readiness_landing' });
  });
});
