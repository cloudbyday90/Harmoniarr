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

async function openDiscoverWithTwoRecommendationInputs(page, baseUrl) {
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
  await page.getByRole('link', { name: /Autechre/ }).waitFor();
  await addArtistFromDiscover(page, 'Autechre');

  await page.getByRole('list', { name: 'Discover summary' }).getByText('2 monitored').waitFor();
  await page.getByText('Using all 2 monitored artists.').waitFor();
}

async function assertSharedAphexRecommendation(page) {
  const aphexTwinCard = page.getByRole('link', { name: /Aphex Twin/ });
  await aphexTwinCard.waitFor();
  await aphexTwinCard.getByText('Shared by 2 of your monitored artists').waitFor();
}

async function assertFocusedAphexRecommendation(page) {
  const aphexTwinCard = page.getByRole('link', { name: /Aphex Twin/ });
  await aphexTwinCard.waitFor();
  await aphexTwinCard.getByText('From your monitored artists').waitFor();
  assert.equal(
    await aphexTwinCard.getByText('Shared by 2 of your monitored artists').count(),
    0,
  );
}

suite('Discover temporary recommendation focus browser coverage', () => {
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

  test('Discover can temporarily focus recommendations by monitored artist and preserve it across reload', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await openDiscoverWithTwoRecommendationInputs(page, baseUrl);
      await assertSharedAphexRecommendation(page);

      const boardsFocusCheckbox = page.getByRole('checkbox', {
        name: 'Focus recommendations on Boards of Canada',
      });
      await boardsFocusCheckbox.check();
      await page.waitForURL((url) => url.searchParams.get('focusArtist') === 'mb-artist-boards');
      assert.equal(await boardsFocusCheckbox.isChecked(), true);
      await page.getByRole('list', { name: 'Discover summary' }).getByText('1 focused').waitFor();
      await page.getByText('Focused on 1 monitored artist.').waitFor();
      await assertFocusedAphexRecommendation(page);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.searchParams.get('focusArtist') === 'mb-artist-boards');
      await page.getByText('Focused on 1 monitored artist.').waitFor();
      assert.equal(
        await page.getByRole('checkbox', { name: 'Focus recommendations on Boards of Canada' }).isChecked(),
        true,
      );
      await assertFocusedAphexRecommendation(page);

      await page.getByRole('button', { name: 'Use all monitored artists' }).click();
      await page.waitForURL((url) => !url.searchParams.has('focusArtist'));
      await page.getByText('Using all 2 monitored artists.').waitFor();
      await assertSharedAphexRecommendation(page);
    }, {
      scenarioName: 'discover_recommendation_focus_filter',
    });
  });
});
