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

function buildDownloaderPayload({ enabled }) {
  return {
    downloader: {
      observedAt: '2026-08-01T14:00:00.000Z',
      providerState: {
        enabled,
        message: enabled
          ? 'Soulseek is ready for downloads.'
          : 'Soulseek is off. Set it up in Settings to enable downloads.',
      },
      queueHealth: {
        counts: {
          active: 0,
          completed: 0,
          failed: 0,
          other: 0,
          queued: 0,
          total: 0,
        },
        message: enabled ? 'No active downloads right now.' : 'Soulseek is off.',
        status: enabled ? 'idle' : 'disabled',
      },
      transfers: [],
    },
  };
}

suite('Downloader provider setup handoff browser verification', () => {
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

  test('disabled Downloader setup returns through Connections without continuing to poll a disabled queue', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let downloaderEnabled = false;
      let soulseekIsHealthy = false;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route('**/api/v1/downloader/queue', async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildDownloaderPayload({ enabled: downloaderEnabled })),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/slskd/status', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            provider: 'slskd',
            status: {
              provider: 'slskd',
              status: soulseekIsHealthy ? 'healthy' : 'disabled',
            },
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        if (route.request().method() !== 'GET') {
          downloaderEnabled = true;
          await route.continue();
          return;
        }

        const response = await route.fetch();
        const payload = await response.json();
        payload.settings.slskd.providerMode = 'external';
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          managedDeploymentDetected: false,
          providerMode: 'external',
          providerModeState: 'external_ready',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      const queue = page.locator('.hx-card').filter({ hasText: 'Transfer Queue' });
      await queue.getByText('Set up Soulseek to enable downloads').waitFor();
      await queue.getByText('Harmoniarr will not search, download, or check transfers while it is off.').waitFor();
      assert.equal(
        await queue.getByRole('link', { name: 'Set up Soulseek' }).getAttribute('href'),
        '/app/settings/connections?returnTo=downloader',
      );

      await Promise.all([
        page.waitForURL(/\/app\/settings\/connections\?returnTo=downloader$/),
        queue.getByRole('link', { name: 'Set up Soulseek' }).click(),
      ]);

      soulseekIsHealthy = true;
      await page.getByRole('button', { name: 'Save settings' }).click();

      const confirmation = page.locator('.settings-recovery-confirmation');
      await confirmation.getByRole('heading', { name: 'Soulseek is ready' }).waitFor();
      assert.equal(
        await confirmation.getByRole('link', { name: 'Return to Downloader' }).getAttribute('href'),
        '/app/downloader',
      );

      await Promise.all([
        page.waitForURL(/\/app\/downloader$/),
        confirmation.getByRole('link', { name: 'Return to Downloader' }).click(),
      ]);
      await queue.getByText('Nothing downloading right now').waitFor();
      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'downloader_provider_setup_handoff' });
  });
});
