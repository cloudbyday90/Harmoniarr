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
import { installLibraryBrowserFixtures } from '../../testing/browser/library-browser-fixtures.js';
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import {
  bootstrapAdminThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  assertLocatorFocused,
  assertRovingGridMovement,
  getItemControlTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const cardCellSelector = '.hx-media-card__link-area';
const cardActionSelector = '.hx-media-card__actions :is(a[href], button, input, select, textarea, [tabindex])';

let browserRuntime;
let runtimeUnavailableReason = null;

async function submitCatalogSearch(page, query) {
  await page.getByLabel('Search for an artist or release').fill(query);
  await page.getByRole('button', { name: 'Search' }).click();
}

async function assertInactiveCardActionsManaged(list) {
  const controlTabindexes = await getItemControlTabindexes(list, {
    cellSelector: cardCellSelector,
    controlSelector: cardActionSelector,
  });

  assert.deepEqual(
    controlTabindexes.map((values) => values[0] ?? null).slice(0, 3),
    [null, '-1', '-1'],
  );
}

suite('platform card-grid browser keyboard roving coverage', () => {
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

  test('Library release grid exposes roving keyboard focus in the browser', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installLibraryBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Library' }).waitFor();
      await page.getByRole('radio', { name: 'Grid' }).waitFor();

      await assertRovingGridMovement({
        expectedCount: 4,
        list: page.getByRole('list', { name: 'Library releases' }),
        page,
      });
    }, {
      scenarioName: 'library_card_grid_keyboard_roving',
    });
  });

  test('Search artist and release grids expose roving keyboard focus and skip inactive actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(`${baseUrl}/app/search`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Search', exact: true }).waitFor();

      await submitCatalogSearch(page, 'fixture electronic');
      await page.getByRole('heading', { name: 'Artists' }).waitFor();
      await page.getByRole('heading', { name: 'Releases' }).waitFor();

      const artistList = page.getByRole('list', { name: 'Artist search results' });
      await assertRovingGridMovement({
        expectedCount: 4,
        list: artistList,
        page,
      });
      await assertInactiveCardActionsManaged(artistList);

      const releaseList = page.getByRole('list', { name: 'Release search results' });
      await assertRovingGridMovement({
        expectedCount: 3,
        list: releaseList,
        page,
      });
      await assertInactiveCardActionsManaged(releaseList);

      const artistCells = artistList.locator(cardCellSelector);
      const activeArtistAction = artistList.locator(cardActionSelector).first();
      const releaseCells = releaseList.locator(cardCellSelector);

      await page.getByRole('button', { name: 'Search' }).focus();
      await page.keyboard.press('Tab');
      await assertLocatorFocused(artistCells.nth(0), 'Tab should enter the artist grid at the active card');
      await page.keyboard.press('Tab');
      await assertLocatorFocused(activeArtistAction, 'Tab should move from the active artist card to its action');
      await page.keyboard.press('Tab');
      await assertLocatorFocused(releaseCells.nth(0), 'Tab should skip inactive artist actions and enter the release grid');
    }, {
      scenarioName: 'search_card_grid_keyboard_roving',
    });
  });
});
