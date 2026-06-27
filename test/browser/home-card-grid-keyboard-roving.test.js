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
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createRequesterThroughApi,
  loginRequesterThroughUi,
} from '../../testing/browser/user-browser-helpers.js';
import {
  assertLocatorFocused,
  assertRovingGridMovement,
  getItemControlTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

const operatorHomeCellSelector = '.hx-media-card__link-area, .operator-home__discover-card';
const requesterHomeCellSelector = '.hx-media-card__link-area, .requester-home-discover-card';
const cardActionSelector = '.hx-media-card__actions :is(a[href], button, input, select, textarea, [tabindex])';

let browserRuntime;
let runtimeUnavailableReason = null;

async function assertInactiveFirstCardActionManaged(page, {
  cellSelector,
  list,
}) {
  const cells = list.locator(cellSelector);

  await cells.nth(0).focus();
  await cells.nth(0).press('ArrowRight');
  await assertLocatorFocused(cells.nth(1), 'ArrowRight should focus the Home Discover tail card');

  const controlTabindexes = await getItemControlTabindexes(list, {
    cellSelector,
    controlSelector: cardActionSelector,
  });

  assert.equal(controlTabindexes[0]?.[0], '-1');
}

suite('Home mixed card-grid browser keyboard roving coverage', () => {
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

  test('operator Home monitored-artist grid includes the Discover tail card in roving focus', {
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

      await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
      await page.getByRole('heading', { name: 'Monitored Artists' }).waitFor();

      const monitoredArtistsList = page.getByRole('list', { name: 'Monitored artists' });
      await monitoredArtistsList.getByRole('link', { name: 'Add more artists from Discover' }).waitFor();

      await assertRovingGridMovement({
        cellSelector: operatorHomeCellSelector,
        expectedCount: 2,
        list: monitoredArtistsList,
        page,
      });
      await assertInactiveFirstCardActionManaged(page, {
        cellSelector: operatorHomeCellSelector,
        list: monitoredArtistsList,
      });
    }, {
      scenarioName: 'operator_home_mixed_card_grid_keyboard_roving',
    });
  });

  test('requester Home monitored-artist grid includes the Discover tail card in roving focus', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await createRequesterThroughApi(page, {
        password: 'RequesterPass123!',
        username: 'listener',
      });
      await logoutThroughUi(page);
      await loginRequesterThroughUi(page, {
        baseUrl,
        beforeReadyNavigation: markBoardsOfCanadaAddedInMetadataBrowserFixture,
        initialPassword: 'RequesterPass123!',
        readyPassword: 'RequesterReady123!',
        username: 'listener',
      });

      await page.getByText('Artists you\'re monitoring and music you care about.').waitFor();
      const monitoredArtistsList = page.getByRole('list', { name: 'Monitored artists' });
      await monitoredArtistsList.getByRole('link', { name: 'Find more artists' }).waitFor();

      await assertRovingGridMovement({
        cellSelector: requesterHomeCellSelector,
        expectedCount: 2,
        list: monitoredArtistsList,
        page,
      });
      await assertInactiveFirstCardActionManaged(page, {
        cellSelector: requesterHomeCellSelector,
        list: monitoredArtistsList,
      });
    }, {
      scenarioName: 'requester_home_mixed_card_grid_keyboard_roving',
    });
  });
});
