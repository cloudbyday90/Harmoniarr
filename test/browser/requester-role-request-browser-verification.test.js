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
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createRequesterThroughApi,
  loginRequesterThroughUi,
} from '../../testing/browser/user-browser-helpers.js';
import {
  assertFocusWithin,
  assertLocatorFocused,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  openGeogaddiReleaseDetail,
  openRequestConfirmationFromCard,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Requester-role request browser verification', () => {
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

  test('requesters submit release requests without requester-for controls or admin user-list reads', {
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

      let fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.userListFetchCount ?? 0, 0);

      const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
      await page.getByText('Requester-safe search flow').waitFor();

      const confirmDialog = await openRequestConfirmationFromCard(
        page,
        releasesList,
        'Music Has the Right to Children',
      );
      await assertFocusWithin(confirmDialog, 'Requester confirmation should keep focus in the dialog after opening');
      assert.equal(await confirmDialog.getByLabel('Request for').count(), 0);

      await confirmDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });

      const requestedCardButton = releasesList.getByRole('button', {
        name: 'Music Has the Right to Children — already requested',
      });
      await requestedCardButton.waitFor();
      assert.equal(await requestedCardButton.getAttribute('disabled'), '');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 1);
      assert.equal(fixtureState.mediaRequests[0].releaseTitle, 'Music Has the Right to Children');
      assert.equal(fixtureState.mediaRequests[0].requestedForUserId, null);
      assert.equal(fixtureState.userListFetchCount ?? 0, 0);

      const { dialog: releaseDetailDialog, geogaddiCard } = await openGeogaddiReleaseDetail(page, baseUrl);
      assert.equal(await page.getByLabel(/^Selection state for /).count(), 0);
      assert.equal(await releaseDetailDialog.getByLabel('For', { exact: true }).count(), 0);

      const detailRequestButton = releaseDetailDialog.getByRole('button', { name: 'Request', exact: true });
      await detailRequestButton.focus();
      await detailRequestButton.press('Enter');
      await releaseDetailDialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(geogaddiCard, 'Successful requester Release Detail request should restore focus');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 2);
      const geogaddiRequest = fixtureState.mediaRequests.find((request) => request.releaseTitle === 'Geogaddi');
      assert.ok(geogaddiRequest, 'Expected fixture to record requester Geogaddi request');
      assert.equal(geogaddiRequest.requestedForUserId, null);
      assert.equal(fixtureState.userListFetchCount ?? 0, 0);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'requester_role_request_browser_verification',
    });
  });
});
