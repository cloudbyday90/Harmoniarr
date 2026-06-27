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
import { installMediaRequestBrowserFixtures } from '../../testing/browser/media-request-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  assertLocatorFocused,
  assertRovingGridMovement,
  waitForRovingTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const requestCellSelector = '.request-card';

let browserRuntime;
let runtimeUnavailableReason = null;

suite('My Requests card-grid browser keyboard roving coverage', () => {
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

  test('My Requests grid exposes roving focus, filters by request status, and opens request detail by keyboard', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMediaRequestBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();
      await page.getByText('Track the music you\'ve asked Harmoniarr to find.').waitFor();

      const requestsList = page.getByRole('list', { name: 'Your requests' });
      await requestsList.getByRole('link', { name: 'Kid A by Radiohead' }).waitFor();
      await requestsList.getByRole('link', { name: 'LP5 by Autechre' }).waitFor();
      await requestsList.getByRole('link', { name: 'Music Has the Right to Children by Boards of Canada' }).waitFor();
      await requestsList.getByRole('link', { name: 'Mezzanine by Massive Attack' }).waitFor();

      await assertRovingGridMovement({
        cellSelector: requestCellSelector,
        expectedCount: 4,
        list: requestsList,
        page,
      });

      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('button', { name: 'Downloading' }).click();

      await requestsList.getByRole('link', { name: 'LP5 by Autechre' }).waitFor();
      assert.equal(await requestsList.locator(requestCellSelector).count(), 1);
      assert.equal(await requestsList.getByText('Kid A').count(), 0);
      assert.equal(await requestsList.getByText('Mezzanine').count(), 0);

      await waitForRovingTabindexes(page, requestsList, {
        cellSelector: requestCellSelector,
        expected: ['0'],
      });

      await page.getByRole('button', { name: 'Clear all' }).click();
      await waitForRovingTabindexes(page, requestsList, {
        cellSelector: requestCellSelector,
        expected: ['0', '-1', '-1', '-1'],
      });

      const cells = requestsList.locator(requestCellSelector);
      await cells.nth(0).focus();
      await assertLocatorFocused(cells.nth(0), 'My Requests should restore focus to the first request card');
      await cells.nth(0).press('Enter');
      await page.waitForURL(/\/app\/requests\/req-kid-a$/u);
      await page.getByRole('heading', { name: 'Radiohead — Kid A' }).waitFor();

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'my_requests_card_grid_keyboard_roving',
    });
  });
});
