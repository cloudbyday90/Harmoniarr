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
import {
  buildEmptyDownloaderQueueFixture,
  buildLinkedDownloaderQueueFixture,
  buildUnlinkedDownloaderTransferFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const wantedReleaseId = 'wanted-amber';
const providerUser = 'amber-fixture-peer';
const providerTransferId = 'transfer-amber-fixture';

const defaultDownloaderQueue = buildLinkedDownloaderQueueFixture();
const amberTransfer = Object.freeze({
  ...defaultDownloaderQueue.transfers[0],
  diagnostics: {
    ...defaultDownloaderQueue.transfers[0].diagnostics,
    importLinkage: {
      ...defaultDownloaderQueue.transfers[0].diagnostics.importLinkage,
      musicQueueRelease: {
        artistName: 'Autechre',
        releaseTitle: 'Amber',
        wantedReleaseId,
        wantedStatus: 'downloading',
      },
    },
  },
  id: providerTransferId,
  sourceUser: providerUser,
  transferKey: `${providerUser}::${providerTransferId}`,
});
const activeDownloaderQueue = Object.freeze(buildLinkedDownloaderQueueFixture({
  queueHealth: {
    ...defaultDownloaderQueue.queueHealth,
    counts: {
      ...defaultDownloaderQueue.queueHealth.counts,
      queued: 1,
      total: 2,
    },
    message: '1 active and 1 queued transfer are in the queue.',
  },
  transfers: [
    amberTransfer,
    buildUnlinkedDownloaderTransferFixture(),
  ],
}));
const completedDownloaderQueue = Object.freeze(buildEmptyDownloaderQueueFixture());

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Legacy Downloader release handoff browser compatibility', () => {
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

  test('keeps a direct legacy Acquisition Downloader link connected to its scoped live-transfer outcome', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const downloaderFixtures = await installDownloaderBrowserFixtures(browserContext, {
        queue: activeDownloaderQueue,
      });
      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(`${baseUrl}/app/acquisition/downloader?wantedReleaseId=${wantedReleaseId}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForURL(new RegExp(`/app/downloader\\?wantedReleaseId=${wantedReleaseId}$`));
      const downloaderUrl = new URL(page.url());
      assert.equal(downloaderUrl.pathname, '/app/downloader');
      assert.deepEqual([...downloaderUrl.searchParams.entries()], [['wantedReleaseId', wantedReleaseId]]);
      assert.doesNotMatch(downloaderUrl.href, new RegExp(`${providerUser}|${providerTransferId}`));

      const transferQueue = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await page.getByRole('heading', { exact: true, name: 'Missing Music transfer' }).waitFor();
      await transferQueue.getByText('Showing 1 transfer linked to this Missing Music release.', { exact: true }).waitFor();
      await transferQueue.getByText('01 Foil.flac', { exact: true }).waitFor();
      assert.equal(await transferQueue.getByText('02 Antarctica Starts Here.flac', { exact: true }).count(), 0);

      await downloaderFixtures.setQueue(completedDownloaderQueue);
      await page.getByRole('button', { exact: true, name: 'Refresh' }).click();
      await transferQueue.getByText('No live transfer for this Missing Music release', { exact: true }).waitFor();
      await transferQueue.getByText(
        'The transfer may not have started, may have completed, or may no longer be in the live queue.',
      ).waitFor();
      await transferQueue.getByRole('link', { name: 'Open release in Missing Music' }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'legacy_downloader_release_handoff_lifecycle' });
  });
});
