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
import {
  installMetadataBrowserFixtures,
  markBoardsOfCanadaAddedInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  assertLocatorFocused,
  assertRovingGridMovement,
  getItemControlTabindexes,
  waitForRovingTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

const releaseCellSelector = '.hx-media-card__link-area';
const selectionControlSelector = '.artist-detail-selection__select';

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Artist Detail per-section card-grid browser keyboard roving coverage', () => {
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

  test('Artist Detail discography sections expose independent roving focus and managed selection controls', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);

      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Albums' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'EPs' }).waitFor();

      const albumsList = page.getByRole('list', { name: /^albums$/iu });
      const epsList = page.getByRole('list', { name: /^eps$/iu });

      await albumsList.getByRole('button', { name: 'View details for Geogaddi' }).waitFor();
      await albumsList.getByRole('button', { name: 'View details for Music Has the Right to Children' }).waitFor();
      await epsList.getByRole('button', { name: 'View details for Hi Scores' }).waitFor();
      await epsList.getByRole('button', { name: 'View details for Twoism' }).waitFor();

      await assertRovingGridMovement({
        expectedCount: 2,
        list: albumsList,
        page,
      });

      await assertRovingGridMovement({
        expectedCount: 2,
        list: epsList,
        page,
      });

      const albumCells = albumsList.locator(releaseCellSelector);
      await albumCells.nth(0).focus();
      await albumCells.nth(0).press('ArrowRight');
      await assertLocatorFocused(albumCells.nth(1), 'Album section ArrowRight should focus the next album card');

      await waitForRovingTabindexes(page, albumsList, {
        cellSelector: releaseCellSelector,
        expected: ['-1', '0'],
      });
      await waitForRovingTabindexes(page, epsList, {
        cellSelector: releaseCellSelector,
        expected: ['0', '-1'],
      });

      const albumControlTabindexes = await getItemControlTabindexes(albumsList, {
        cellSelector: releaseCellSelector,
        controlSelector: selectionControlSelector,
      });
      assert.deepEqual(
        albumControlTabindexes,
        [['-1'], [null]],
        'Only controls inside the active Album card should stay in the sequential tab order',
      );

      await page.keyboard.press('Tab');
      await assertLocatorFocused(
        albumsList.locator(selectionControlSelector).nth(1),
        'Tab from the active Album card should reach its selection control',
      );

      const epControlTabindexes = await getItemControlTabindexes(epsList, {
        cellSelector: releaseCellSelector,
        controlSelector: selectionControlSelector,
      });
      assert.deepEqual(
        epControlTabindexes,
        [[null], ['-1']],
        'The untouched EP section should keep its own active card independent from Albums',
      );

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_section_grid_keyboard_roving',
    });
  });
});
