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
import { installDownloaderBrowserFixtures } from '../../testing/browser/downloader-browser-fixtures.js';
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildMusicQueuePayload({ state = 'searching' } = {}) {
  const status = state === 'downloading'
    ? {
      code: 'downloading',
      detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    }
    : {
      code: 'searching',
      detail: 'Harmoniarr is looking for an acceptable match.',
      label: 'Searching',
      nextAction: 'review_matches',
      tone: 'info',
    };

  return {
    checkedAt: '2026-07-26T17:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forest-frank-auto-download',
      matchedTrackCount: state === 'downloading' ? 12 : 0,
      missingTrackCount: state === 'downloading' ? 0 : 12,
      quality: {
        code: 'accepted',
        profile: { code: 'lossless_archive' },
        tone: 'success',
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status,
    }],
    summary: { counts: { [status.code]: 1 }, total: 1 },
  };
}

function buildQualityStoppedPayload() {
  const status = {
    code: 'quality_choice_needed',
    detail: 'Only lossy matches were found. Harmoniarr did not select one for your lossless archive.',
    label: 'Quality choice needed',
    nextAction: 'review_quality_choice',
    tone: 'warning',
  };

  return {
    checkedAt: '2026-07-26T17:05:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forest-frank-quality-stop',
      missingTrackCount: 12,
      quality: {
        code: 'below_minimum',
        profile: { code: 'lossless_archive' },
        tone: 'warning',
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status,
    }],
    summary: { counts: { quality_choice_needed: 1 }, total: 1 },
  };
}

function buildProviderStoppedPayload() {
  const status = {
    code: 'needs_setup',
    detail: 'Soulseek is turned off. Turn it on and test the connection before Harmoniarr can search or download.',
    label: 'Needs setup',
    nextAction: 'configure_provider',
    tone: 'warning',
  };

  return {
    checkedAt: '2026-07-26T17:10:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forest-frank-provider-stop',
      missingTrackCount: 12,
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status,
    }],
    summary: { counts: { needs_setup: 1 }, total: 1 },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue automatic download handoff browser verification', () => {
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

  test('moves a quality-compliant release from automatic search to the live Downloader without diagnostic navigation', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let queueReadCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await installDownloaderBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        queueReadCount += 1;
        const state = queueReadCount > 1 ? 'downloading' : 'searching';
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload({ state })),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Searching', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr is looking for an acceptable match.').waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Downloader' }).count(), 0);

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Downloading', { exact: true }).waitFor();
      await releaseRow.getByText('Quality profile: Lossless archive').waitFor();
      assert.equal(await releaseRow.getByRole('button', { name: 'Review matches' }).count(), 0);

      await Promise.all([
        page.waitForURL(/\/app\/downloader$/),
        releaseRow.getByRole('link', { name: 'Open Downloader' }).click(),
      ]);
      await page.getByRole('heading', { exact: true, name: 'Downloader' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Transfer Queue' }).waitFor();
      await page.getByText('01 Foil.flac', { exact: true }).waitFor();
      await page.getByRole('progressbar').waitFor();

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_automatic_download_handoff' });
  });

  test('keeps a strict lossless quality stop out of Downloader and sends the user to one review action', {
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
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildQualityStoppedPayload()),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Quality choice needed', { exact: true }).waitFor();
      await releaseRow.getByText('Quality: Below preference').waitFor();
      await releaseRow.getByText('Harmoniarr did not select one for your lossless archive.').waitFor();
      await releaseRow.getByRole('button', { name: 'Review quality choice' }).waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Downloader' }).count(), 0);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_quality_stop_no_download_handoff' });
  });

  test('keeps a disabled provider out of Downloader and provides one bounded connection handoff', {
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
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildProviderStoppedPayload()),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Needs setup', { exact: true }).waitFor();
      await releaseRow.getByText('Soulseek is turned off.').waitFor();
      const providerLink = releaseRow.getByRole('link', { name: 'Test Soulseek' });
      await providerLink.waitFor();
      assert.equal(await providerLink.getAttribute('href'), '/app/settings/connections');
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Downloader' }).count(), 0);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_provider_stop_no_download_handoff' });
  });
});
