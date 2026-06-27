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
  readMetadataBrowserFixtureState,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  assertFocusWithin,
  assertLocatorFocused,
  assertTabFocusContained,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  openGeogaddiReleaseDetail,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Request action browser verification', () => {
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

  test('release cards and Release Detail submit request actions with requester-for payloads', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);

      const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
      const firstReleaseCell = releasesList.locator('.hx-media-card__link-area').first();
      const cardRequestButton = releasesList.getByRole('button', {
        name: 'Request Music Has the Right to Children',
      });
      await firstReleaseCell.focus();
      await page.keyboard.press('Tab');
      await assertLocatorFocused(cardRequestButton, 'Tab from active release card should reach its Request action');
      await assertVisibleFocusOutline(cardRequestButton, 'Card Request button should expose a visible focus ring');
      await cardRequestButton.press('Enter');

      const confirmDialog = page.getByRole('dialog', { name: 'Request this release?' });
      await confirmDialog.waitFor();
      const confirmCloseButton = confirmDialog.getByRole('button', { name: 'Close' });
      await assertLocatorFocused(confirmCloseButton, 'Confirm Request should move initial focus to Close');
      await assertTabFocusContained(page, confirmDialog, { steps: 5 });
      await assertFocusWithin(confirmDialog, 'Confirm Request tab sequence should remain in the dialog');
      await confirmDialog.getByLabel('Request for').selectOption('fixture-listener-user');
      const confirmButton = confirmDialog.getByRole('button', { name: 'Confirm request' });
      await confirmButton.focus();
      await confirmButton.press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });

      const requestedCardButton = releasesList.getByRole('button', {
        name: 'Music Has the Right to Children — already requested',
      });
      await requestedCardButton.waitFor();
      assert.equal(await requestedCardButton.getAttribute('disabled'), '', 'Requested card action should be disabled');

      let fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 1);
      assert.equal(fixtureState.mediaRequests[0].releaseTitle, 'Music Has the Right to Children');
      assert.equal(fixtureState.mediaRequests[0].musicbrainzReleaseId, 'mb-release-mhtrtc');
      assert.equal(fixtureState.mediaRequests[0].requestedForUserId, 'fixture-listener-user');
      assert.equal(fixtureState.mediaRequests[0].linked, false);

      const { dialog: releaseDetailDialog, geogaddiCard } = await openGeogaddiReleaseDetail(page, baseUrl);
      await releaseDetailDialog.getByRole('button', { name: 'Request', exact: true }).waitFor();
      await releaseDetailDialog.getByLabel('For', { exact: true }).selectOption('fixture-listener-user');
      const detailRequestButton = releaseDetailDialog.getByRole('button', { name: 'Request', exact: true });
      await detailRequestButton.focus();
      await assertVisibleFocusOutline(detailRequestButton, 'Release Detail Request button should expose a visible focus ring');
      await detailRequestButton.press('Enter');
      await releaseDetailDialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(geogaddiCard, 'Successful Release Detail request should restore focus to the opener');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 2);
      const geogaddiRequest = fixtureState.mediaRequests.find((request) => request.releaseTitle === 'Geogaddi');
      assert.ok(geogaddiRequest, 'Expected fixture to record the Geogaddi request');
      assert.equal(geogaddiRequest.musicbrainzReleaseId, 'mb-release-geogaddi');
      assert.equal(geogaddiRequest.releaseGroupId, 'mb-rg-geogaddi');
      assert.equal(geogaddiRequest.requestedForUserId, 'fixture-listener-user');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_action_browser_verification',
    });
  });
});
