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

function buildMusicQueuePayload() {
  return {
    checkedAt: '2026-08-25T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 2 },
    releases: [
      {
        artistName: 'Fixture Artist',
        expectedTrackCount: 10,
        id: 'wanted-action',
        matchedTrackCount: 0,
        missingTrackCount: 10,
        quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
        releaseTitle: 'Choose a match',
        status: {
          code: 'pick_match',
          detail: 'Choose one of the available matches before the download can continue.',
          label: 'Choose a match',
          tone: 'warning',
        },
      },
      {
        artistName: 'Fixture Artist',
        expectedTrackCount: 12,
        id: 'wanted-progress',
        matchedTrackCount: 12,
        missingTrackCount: 0,
        quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
        releaseTitle: 'Preparing automatically',
        status: {
          code: 'downloading',
          detail: 'Harmoniarr is waiting for the selected download to finish.',
          label: 'Downloading',
          tone: 'info',
        },
      },
    ],
    summary: { counts: { downloading: 1, pick_match: 1 }, total: 2 },
  };
}

function buildDownloaderPayload() {
  return {
    downloader: {
      providerState: { enabled: true, message: 'Soulseek download provider is ready.' },
      queueHealth: { counts: { active: 1, queued: 1 } },
      transfers: [
        {
          averageSpeed: 1024,
          filename: '/downloads/Active transfer.flac',
          id: 'transfer-active',
          progress: { percentComplete: 50, size: 2048 },
          sourceUser: 'fixture-source',
          state: { code: 'active', label: 'Downloading', tone: 'warning' },
          transferKey: 'fixture-source::transfer-active',
        },
        {
          filename: '/downloads/Queued transfer.flac',
          id: 'transfer-queued',
          progress: { percentComplete: null, size: 4096 },
          sourceUser: 'fixture-source',
          state: { code: 'queued', label: 'Queued', tone: 'info' },
          transferKey: 'fixture-source::transfer-queued',
        },
      ],
    },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Acquisition overview browser verification', () => {
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

  test('shows separate release and transfer lanes with links to their existing workspaces', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
          status: 200,
        });
      });
      await browserContext.route(/\/api\/v1\/downloader\/queue(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildDownloaderPayload()),
          contentType: 'application/json',
          status: 200,
        });
      });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/acquisition`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Acquisition overview' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Release work' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Download progress' }).waitFor();
      await page.getByText('Available actions', { exact: true }).waitFor();
      await page.getByText('Moving automatically', { exact: true }).waitFor();
      await page.getByText('Active transfers', { exact: true }).waitFor();
      await page.getByText('Queued transfers', { exact: true }).waitFor();

      const reviewLink = page.getByRole('link', { name: 'Review', exact: true });
      assert.equal(await reviewLink.getAttribute('href'), '/app/music-queue/wanted-action');

      const transferLink = page.getByRole('link', {
        name: 'Open Active transfer.flac in Downloader',
      });
      const transferHref = await transferLink.getAttribute('href');
      assert.match(transferHref ?? '', /\/app\/downloader\?open=details&transferId=transfer-active&username=fixture-source$/);
      await page.getByRole('progressbar', { name: 'Active transfer.flac: 50%' }).waitFor();
      await page.getByRole('link', { name: 'Open Downloader', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Clear Completed' }).count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'acquisition_overview' });
  });
});
