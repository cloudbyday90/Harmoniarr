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
import { installScopedMusicQueueReadModelFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { installWantedBrowserFixtures } from '../../testing/browser/wanted-browser-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const wantedReleaseId = 'wanted-amber';
const providerUser = 'amber-fixture-peer';
const providerTransferId = 'transfer-amber-fixture';

function buildMusicQueueRelease({ state }) {
  const isDownloading = state === 'downloading';
  const status = isDownloading
    ? {
      code: 'downloading',
      detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    }
    : {
      code: 'searching',
      detail: 'Harmoniarr is looking for an acceptable lossless match.',
      label: 'Searching',
      nextAction: 'review_matches',
      tone: 'info',
    };

  return {
    artistName: 'Autechre',
    expectedTrackCount: 10,
    id: wantedReleaseId,
    matchedTrackCount: isDownloading ? 10 : 0,
    missingTrackCount: isDownloading ? 0 : 10,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseGroupType: 'Album',
    releaseTitle: 'Amber',
    status,
  };
}

const searchingRelease = Object.freeze(buildMusicQueueRelease({ state: 'searching' }));
const downloadingRelease = Object.freeze(buildMusicQueueRelease({ state: 'downloading' }));
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

suite('Missing Music to Downloader browser acceptance', () => {
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

  test('carries one confirmed Missing Music release through automatic download and its scoped live-transfer outcome', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let searchRequest = null;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await installWantedBrowserFixtures(browserContext);
      const musicQueueFixtures = await installScopedMusicQueueReadModelFixtures(browserContext, {
        release: searchingRelease,
      });
      const downloaderFixtures = await installDownloaderBrowserFixtures(browserContext, {
        queue: activeDownloaderQueue,
      });
      await browserContext.route('**/api/v1/library/media-requests', async (route) => {
        searchRequest = {
          body: route.request().postDataJSON(),
          csrfHeaderPresent: Boolean(await route.request().headerValue('x-csrf-token')),
          method: route.request().method(),
        };
        await route.fulfill({
          body: JSON.stringify({
            mediaRequest: { id: 'request-amber-browser-acceptance' },
            ok: true,
          }),
          contentType: 'application/json',
          status: 201,
        });
      });

      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', {
        name: 'Start a search for Autechre — Amber',
      }).click();
      const confirmation = page.getByRole('dialog', { name: 'Search for this release?' });
      await confirmation.getByText(
        'Harmoniarr will add this release to Music Queue, where it will be searched using your active settings.',
      ).waitFor();

      await Promise.all([
        page.waitForURL(new RegExp(`/app/music-queue/${wantedReleaseId}$`)),
        confirmation.getByRole('button', { name: 'Start search' }).click(),
      ]);
      assert.deepEqual(searchRequest, {
        body: {
          artistName: 'Autechre',
          expectedReleaseDate: null,
          musicbrainzReleaseId: 'mb-release-amber',
          releaseGroupId: 'mb-rg-amber',
          releaseTitle: 'Amber',
          requestKind: 'release',
        },
        csrfHeaderPresent: true,
        method: 'POST',
      });

      const musicQueueUrl = new URL(page.url());
      assert.equal(musicQueueUrl.pathname, `/app/music-queue/${wantedReleaseId}`);
      assert.equal(musicQueueUrl.search, '');
      assert.doesNotMatch(musicQueueUrl.href, new RegExp(`${providerUser}|${providerTransferId}`));

      const musicQueueDetails = page.getByRole('complementary', { name: 'Music Queue release details' });
      await musicQueueDetails.getByRole('heading', { name: 'Amber by Autechre' }).waitFor();
      await musicQueueDetails.getByText('Searching', { exact: true }).waitFor();
      const progress = musicQueueDetails.getByRole('region', { name: 'Progress' });
      await progress.getByText('Harmoniarr is looking for an acceptable lossless match.', { exact: true }).waitFor();

      musicQueueFixtures.setRelease(downloadingRelease);
      await page.getByRole('button', { exact: true, name: 'Refresh' }).click();
      await musicQueueDetails.getByText('Downloading', { exact: true }).waitFor();
      const downloadProgressLink = musicQueueDetails.getByRole('link', {
        name: 'View download progress for Autechre — Amber',
      });
      await downloadProgressLink.waitFor();
      assert.equal(
        await downloadProgressLink.getAttribute('href'),
        `/app/downloader?wantedReleaseId=${wantedReleaseId}`,
      );

      await Promise.all([
        page.waitForURL(new RegExp(`/app/downloader\\?wantedReleaseId=${wantedReleaseId}$`)),
        downloadProgressLink.click(),
      ]);
      const downloaderUrl = new URL(page.url());
      assert.deepEqual([...downloaderUrl.searchParams.entries()], [['wantedReleaseId', wantedReleaseId]]);
      assert.doesNotMatch(downloaderUrl.href, new RegExp(`${providerUser}|${providerTransferId}`));

      const transferQueue = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await page.getByRole('heading', { exact: true, name: 'Music Queue transfer' }).waitFor();
      await transferQueue.getByText('Showing 1 transfer linked to this Music Queue release.', { exact: true }).waitFor();
      await transferQueue.getByText('01 Foil.flac', { exact: true }).waitFor();
      assert.equal(await transferQueue.getByText('02 Antarctica Starts Here.flac', { exact: true }).count(), 0);

      await downloaderFixtures.setQueue(completedDownloaderQueue);
      await page.getByRole('button', { exact: true, name: 'Refresh' }).click();
      await transferQueue.getByText('No live transfer for this Music Queue release', { exact: true }).waitFor();
      await transferQueue.getByText(
        'The transfer may not have started, may have completed, or may no longer be in the live queue.',
      ).waitFor();
      await transferQueue.getByRole('link', { name: 'Open release in Music Queue' }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'missing_music_to_downloader_lifecycle' });
  });
});
