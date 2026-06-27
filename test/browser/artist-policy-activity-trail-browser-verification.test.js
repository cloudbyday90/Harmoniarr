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
  markBoardsTrackOverrideReviewNeededInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

async function openBoardsReleaseDetail(page, baseUrl) {
  await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
  await page.getByLabel('Albums selection filter').selectOption('track_review');
  const albumsList = page.getByRole('list', { name: /^albums$/iu });
  await albumsList.getByText('1 track override needs review').first().waitFor();

  await albumsList.getByRole('button', {
    name: 'View details for Music Has the Right to Children',
  }).click();

  const dialog = page.getByRole('dialog', { name: 'Release detail' });
  await dialog.waitFor();
  await dialog.getByText('Roygbiv').waitFor();
  await dialog.getByText('Needs review', { exact: true }).waitFor();
  return dialog;
}

suite('Artist Policy Activity trail browser verification', () => {
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

  test('saved Artist Policy repairs appear in Activity and link back to Artist Detail', {
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
      await markBoardsTrackOverrideReviewNeededInMetadataBrowserFixture(page);

      const dialog = await openBoardsReleaseDetail(page, baseUrl);
      await dialog.getByRole('button', { name: 'Keep this track for Roygbiv' }).click();
      await dialog.getByText('Needs review', { exact: true }).waitFor({ state: 'hidden' });
      await dialog.getByRole('button', { name: 'Close' }).click();
      await dialog.waitFor({ state: 'hidden' });

      await page.getByText('Unsaved changes').waitFor();
      await page.getByRole('button', { name: 'Save policy' }).click();
      await page.getByText('Saved', { exact: true }).waitFor();

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Household Activity' }).waitFor();

      const policyEvent = page.getByRole('listitem').filter({
        hasText: 'Artist policy saved for Boards of Canada',
      });
      await policyEvent.waitFor();
      await policyEvent.getByText('1 track override; 1 track review repaired').waitFor();
      await policyEvent.getByRole('link', { name: 'Open artist policy' }).click();

      await page.waitForURL('**/app/artists/mb-artist-boards');
      await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Artist Policy' }).waitFor();

      assert.match(page.url(), /\/app\/artists\/mb-artist-boards$/u);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_policy_activity_trail_browser_verification',
    });
  });
});
