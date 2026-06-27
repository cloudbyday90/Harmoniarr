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
  openRequestConfirmationFromCard,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Requester Request Detail cancellation browser verification', () => {
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

  test('requesters can cancel their submitted request from Request Detail and see refreshed state', {
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
        initialPassword: 'RequesterPass123!',
        readyPassword: 'RequesterReady123!',
        username: 'listener',
      });

      const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
      const confirmRequestDialog = await openRequestConfirmationFromCard(
        page,
        releasesList,
        'Music Has the Right to Children',
      );
      await confirmRequestDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
      await confirmRequestDialog.waitFor({ state: 'hidden' });

      const createdFixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(createdFixtureState.mediaRequests.length, 1);
      const requestId = createdFixtureState.mediaRequests[0].id;
      assert.equal(createdFixtureState.mediaRequests[0].requestState, 'needs_fetch');

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', {
        exact: true,
        name: 'Boards of Canada \u2014 Music Has the Right to Children',
      }).waitFor();
      await page.getByRole('button', { name: 'Cancel request' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Reassign' }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Open in import review' }).count(), 0);

      await page.getByRole('button', { name: 'Cancel request' }).click();
      const cancelDialog = page.getByRole('alertdialog');
      await cancelDialog.waitFor();
      await cancelDialog.getByRole('heading', { exact: true, name: 'Cancel request?' }).waitFor();
      await cancelDialog
        .getByText('This request will be cancelled and any in-flight fulfillment work will stop.', { exact: true })
        .waitFor();
      await cancelDialog.getByRole('button', { name: 'Keep' }).waitFor();
      await cancelDialog.getByRole('button', { name: 'Cancel request' }).press('Enter');
      await cancelDialog.waitFor({ state: 'hidden' });

      await page.getByRole('status').filter({ hasText: 'Request cancelled.' }).waitFor();
      const requestJourney = page.getByRole('article').filter({ hasText: 'Request journey' });
      await requestJourney.getByText('Request was cancelled.', { exact: true }).waitFor();
      await requestJourney.getByText('Search was cancelled.', { exact: true }).waitFor();
      await requestJourney.getByText('Cancelled before downloading.', { exact: true }).waitFor();
      await requestJourney.getByText('Cancelled before importing.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Cancel request' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reassign' }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Open in import review' }).count(), 0);

      const cancelledFixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(cancelledFixtureState.mediaRequests.length, 1);
      assert.equal(cancelledFixtureState.mediaRequests[0].id, requestId);
      assert.equal(cancelledFixtureState.mediaRequests[0].requestState, 'cancelled');

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();
      const requestsList = page.getByRole('list', { name: 'Your requests' });
      await requestsList.getByRole('link', {
        name: 'Music Has the Right to Children by Boards of Canada',
      }).waitFor();
      await requestsList.getByText('Cancelled', { exact: true }).waitFor();
      assert.equal(await requestsList.getByText('Searching', { exact: true }).count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_cancellation',
    });
  });
});
