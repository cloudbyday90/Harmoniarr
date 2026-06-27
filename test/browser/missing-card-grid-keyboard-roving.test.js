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
import { installWantedBrowserFixtures } from '../../testing/browser/wanted-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
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

suite('Missing release-card browser keyboard roving coverage', () => {
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

  test('Missing release grid exposes roving focus and keeps only active-card actions tabbable', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installWantedBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Missing' }).waitFor();
      await page.getByRole('heading', { name: 'Wanted releases' }).waitFor();
      await page.getByText('Download recovery needs review').waitFor();

      const missingList = page.getByRole('list', { name: 'Missing releases' });
      const cells = missingList.locator(cardCellSelector);
      const actionControls = missingList.locator(cardActionSelector);

      await assertRovingGridMovement({
        cellSelector: cardCellSelector,
        expectedCount: 3,
        list: missingList,
        page,
      });

      await page.keyboard.press('Tab');
      await assertLocatorFocused(
        actionControls.first(),
        'Tab should move from the active Missing release card to its Request action',
      );

      await cells.nth(0).focus();
      await cells.nth(0).press('ArrowRight');
      await assertLocatorFocused(cells.nth(1), 'ArrowRight should focus the next Missing release card');

      const controlTabindexes = await getItemControlTabindexes(missingList, {
        cellSelector: cardCellSelector,
        controlSelector: cardActionSelector,
      });

      assert.deepEqual(controlTabindexes[0], ['-1']);
      assert.ok(
        controlTabindexes[1].length >= 2,
        'the active recovery card should expose both Retry discovery and Request controls',
      );
      assert.deepEqual(
        controlTabindexes[1].map((value) => value ?? null),
        Array.from({ length: controlTabindexes[1].length }, () => null),
      );
    }, {
      scenarioName: 'missing_release_card_grid_keyboard_roving',
    });
  });
});
