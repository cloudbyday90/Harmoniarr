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
import {
  assertLocatorFocused,
  assertVisibleFocusOutline,
  getRovingActiveIndex,
  waitForRovingTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const cardCellSelector = '.hx-media-card__link-area';
const chipCellSelector = '.discover-monitored-chip';

let browserRuntime;
let runtimeUnavailableReason = null;

async function addArtistFromDiscover(page, artistName) {
  await page.getByRole('button', { name: `Add ${artistName}` }).click();
  const addArtistDialog = page.getByRole('dialog', { name: artistName });
  await addArtistDialog.waitFor();
  await addArtistDialog.getByRole('button', { name: 'Add artist', exact: true }).click();
}

async function openDiscoverWithBoardsRecommendationInput(page, baseUrl) {
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
}

suite('Discover browser keyboard roving coverage', () => {
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

  test('recommendation cards and monitored chips expose roving keyboard focus in the browser', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await openDiscoverWithBoardsRecommendationInput(page, baseUrl);

      const recommendationList = page.getByRole('list', { name: 'Recommended artists' });
      const recommendationCells = recommendationList.locator(cardCellSelector);
      await recommendationCells.nth(2).waitFor();
      assert.equal(await recommendationCells.count(), 3);

      await waitForRovingTabindexes(page, recommendationList, {
        cellSelector: cardCellSelector,
        expected: ['0', '-1', '-1'],
      });

      await recommendationCells.nth(0).focus();
      await recommendationCells.nth(0).press('ArrowRight');
      await assertLocatorFocused(recommendationCells.nth(1), 'ArrowRight should focus the next recommendation card');
      await assertVisibleFocusOutline(recommendationCells.nth(1), 'recommendation card focus ring should be visible');
      await waitForRovingTabindexes(page, recommendationList, {
        cellSelector: cardCellSelector,
        expected: ['-1', '0', '-1'],
      });

      await recommendationCells.nth(1).press('Control+End');
      await assertLocatorFocused(recommendationCells.nth(2), 'Control+End should focus the last recommendation card');
      await waitForRovingTabindexes(page, recommendationList, {
        cellSelector: cardCellSelector,
        expected: ['-1', '-1', '0'],
      });

      await recommendationCells.nth(2).press('Control+Home');
      await assertLocatorFocused(recommendationCells.nth(0), 'Control+Home should focus the first recommendation card');
      await waitForRovingTabindexes(page, recommendationList, {
        cellSelector: cardCellSelector,
        expected: ['0', '-1', '-1'],
      });

      await addArtistFromDiscover(page, 'Autechre');
      await page.getByRole('list', { name: 'Discover summary' }).getByText('2 monitored').waitFor();

      const monitoredList = page.getByRole('list', { name: 'Your monitored artists' });
      const monitoredChips = monitoredList.locator(chipCellSelector);
      await monitoredChips.nth(1).waitFor();

      await monitoredChips.nth(0).focus();
      await waitForRovingTabindexes(page, monitoredList, {
        cellSelector: chipCellSelector,
        expected: ['0', '-1'],
      });

      await monitoredChips.nth(0).press('ArrowRight');
      await assertLocatorFocused(monitoredChips.nth(1), 'ArrowRight should focus the next monitored-artist chip');
      await assertVisibleFocusOutline(monitoredChips.nth(1), 'monitored chip focus ring should be visible');
      await waitForRovingTabindexes(page, monitoredList, {
        cellSelector: chipCellSelector,
        expected: ['-1', '0'],
      });

      await monitoredChips.nth(1).press('Home');
      await assertLocatorFocused(monitoredChips.nth(0), 'Home should focus the first monitored-artist chip');
      await waitForRovingTabindexes(page, monitoredList, {
        cellSelector: chipCellSelector,
        expected: ['0', '-1'],
      });

      const refreshedRecommendationCells = recommendationList.locator(cardCellSelector);
      const activeRecommendationIndex = await getRovingActiveIndex(recommendationList, cardCellSelector);
      assert.ok(activeRecommendationIndex >= 0, 'expected one active recommendation card');

      await page.getByRole('button', { name: 'Search' }).focus();
      await page.keyboard.press('Tab');
      await assertLocatorFocused(monitoredChips.nth(0), 'Tab should enter the monitored-artist band at one chip');
      await page.keyboard.press('Tab');
      await assertLocatorFocused(
        refreshedRecommendationCells.nth(activeRecommendationIndex),
        'Tab should enter the recommendation grid at the active roving card',
      );
    }, {
      scenarioName: 'discover_keyboard_roving',
    });
  });
});
