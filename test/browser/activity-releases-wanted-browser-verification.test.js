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
import { installReleaseRadarBrowserFixtures } from '../../testing/browser/release-radar-browser-fixtures.js';
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

async function assertActivityReleaseGrid(page, listName) {
  const releaseList = page.getByRole('list', { name: listName });
  const cells = releaseList.locator(cardCellSelector);
  const actionControls = releaseList.locator(cardActionSelector);

  await assertRovingGridMovement({
    cellSelector: cardCellSelector,
    expectedCount: 2,
    list: releaseList,
    page,
  });

  await page.keyboard.press('Tab');
  await assertLocatorFocused(
    actionControls.first(),
    `Tab should move from the active ${listName} card to its Request action`,
  );

  await cells.nth(0).focus();
  await cells.nth(0).press('ArrowRight');
  await assertLocatorFocused(cells.nth(1), `ArrowRight should focus the next ${listName} card`);

  const controlTabindexes = await getItemControlTabindexes(releaseList, {
    cellSelector: cardCellSelector,
    controlSelector: cardActionSelector,
  });

  assert.deepEqual(controlTabindexes[0], ['-1']);
  assert.deepEqual(controlTabindexes[1], [null]);
}

suite('Activity releases/wanted browser verification', () => {
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

  test('Activity Releases recent and upcoming grids expose roving focus and managed request actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installReleaseRadarBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/activity/releases`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Releases' }).waitFor();
      await page.getByRole('heading', { name: 'New this month' }).waitFor();
      await page.getByRole('heading', { name: 'Coming soon' }).waitFor();
      await page.getByText('Selected Ambient Works III').waitFor();

      await assertActivityReleaseGrid(page, 'Recent releases');
      await assertActivityReleaseGrid(page, 'Upcoming releases');

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'activity_releases_card_grid_keyboard_roving',
    });
  });

  test('Activity Wanted exposes the wanted table and recovery retry action in the browser', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await installWantedBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/activity/wanted`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Wanted' }).waitFor();
      await page.getByRole('heading', { name: 'Wanted releases' }).waitFor();

      const wantedTable = page.getByRole('table', { name: 'Wanted releases' });
      await wantedTable.getByRole('columnheader', { name: 'Artist' }).waitFor();
      await wantedTable.getByRole('cell', { name: 'Autechre' }).waitFor();
      const amberRow = wantedTable.getByRole('row').filter({ hasText: 'Amber' }).first();
      await wantedTable.getByText('Music Has the Right to Children').first().waitFor();
      await wantedTable.getByText('Kid A').first().waitFor();
      await amberRow.getByText('1 candidate', { exact: true }).waitFor();
      await amberRow.getByText('Last search found matching downloads.', { exact: true }).waitFor();
      await amberRow.getByRole('link', { name: 'Open match diagnostics' }).waitFor();
      await amberRow.getByText('Queued in Downloader', { exact: true }).waitFor();
      await amberRow.getByText('1 Downloader transfer accepted.', { exact: true }).waitFor();
      await wantedTable.getByText('No candidates', { exact: true }).waitFor();
      await wantedTable.getByText('Last search returned no candidates; Harmoniarr will retry after cooldown.', {
        exact: true,
      }).waitFor();
      await page.getByText('Download recovery needs review').waitFor();

      const retryButton = page.getByRole('button', {
        name: 'Retry discovery for Music Has the Right to Children',
      });
      await retryButton.focus();
      await assertLocatorFocused(retryButton, 'Activity Wanted recovery retry button should be keyboard-focusable');
      await retryButton.press('Enter');
      await page.getByText('Recovery retry queued.').waitFor();

      const retryRequests = await page.evaluate(() => globalThis.__harmoniarrWantedRetryRequests);
      assert.deepEqual(retryRequests, ['metadata-release-mhtrtc']);

      await amberRow.getByRole('link', { name: 'Open match diagnostics' }).click();
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/activity/diagnostics/matches'
          && url.searchParams.get('sourceSearchId') === 'search-discovery-dispatch-amber'
          && url.searchParams.get('status') === 'all';
      });
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      await page.getByText('1 matching candidates', { exact: true }).waitFor();
      await page.getByText('healthy-slskd-peer', { exact: true }).first().waitFor();
      await page.getByText('/private/staging/Autechre/Amber', { exact: true }).first().waitFor();

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'activity_wanted_table_recovery_retry',
    });
  });
});
