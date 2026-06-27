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
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import {
  bootstrapAdminThroughUi,
  navigateWithinApp,
} from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let browserRuntime;
let runtimeUnavailableReason = null;

async function addArtistFromDiscover(page, artistName) {
  await page.getByRole('button', { name: `Add ${artistName}` }).click();
  const addArtistDialog = page.getByRole('dialog', { name: artistName });
  await addArtistDialog.waitFor();
  await addArtistDialog.getByRole('button', { name: 'Add artist', exact: true }).click();
}

async function assertDiscoverHydratedFromTwoMonitoredArtists(page) {
  await page.getByRole('heading', { name: 'Recommended artists' }).waitFor();
  await page.getByRole('list', { name: 'Discover summary' }).getByText('2 monitored').waitFor();

  const monitoredArtistsList = page.getByRole('list', { name: 'Your monitored artists' });
  await monitoredArtistsList.getByRole('link', { name: 'View Boards of Canada' }).waitFor();
  await monitoredArtistsList.getByRole('link', { name: 'View Autechre' }).waitFor();

  const sharedRecommendationCard = page.getByRole('link', { name: /Aphex Twin/ });
  await sharedRecommendationCard.waitFor();
  await sharedRecommendationCard.getByText('Shared by 2 of your monitored artists').waitFor();
}

suite('Discover refresh regression coverage', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await browserRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('Discover refresh preserves recommendations after monitoring multiple artists', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await navigateWithinApp(page, {
        heading: 'Discover',
        linkName: 'Discover',
        urlPattern: /\/app\/discover(?:\?.*)?(?:#.*)?$/,
      });

      await page.getByLabel('Search for an artist').fill('Boards of Canada');
      await page.getByRole('button', { name: 'Search' }).click();
      await page.getByRole('link', { name: 'Boards of Canada' }).waitFor();

      await addArtistFromDiscover(page, 'Boards of Canada');
      await page.getByRole('heading', { name: 'Recommended artists' }).waitFor();
      await page.getByRole('link', { name: 'Autechre' }).waitFor();

      await addArtistFromDiscover(page, 'Autechre');
      await assertDiscoverHydratedFromTwoMonitoredArtists(page);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/app\/discover(?:\?.*)?(?:#.*)?$/);
      await assertDiscoverHydratedFromTwoMonitoredArtists(page);

      assert.match(page.url(), /\/app\/discover(?:\?.*)?(?:#.*)?$/);
    }, {
      scenarioName: 'discover_refresh_multiple_monitored_artists',
    });
  });
});
