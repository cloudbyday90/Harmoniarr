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

suite('Post-request My Requests refresh browser verification', () => {
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

  test('requesters can see a newly submitted release in My Requests without manual recovery', {
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

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();
      await page.getByText('No requests yet').waitFor();

      const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
      const confirmDialog = await openRequestConfirmationFromCard(
        page,
        releasesList,
        'Music Has the Right to Children',
      );
      assert.equal(await confirmDialog.getByLabel('Request for').count(), 0);
      await confirmDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 1);
      assert.equal(fixtureState.mediaRequests[0].releaseTitle, 'Music Has the Right to Children');
      assert.equal(fixtureState.mediaRequests[0].requestedForUserId, null);

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();

      const requestsList = page.getByRole('list', { name: 'Your requests' });
      const submittedRequest = requestsList.getByRole('link', {
        name: 'Music Has the Right to Children by Boards of Canada',
      });
      await submittedRequest.waitFor();
      await requestsList.getByText('Release').waitFor();
      await requestsList.getByText('Searching').waitFor();
      assert.equal(await requestsList.getByText('No requests yet').count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'post_request_my_requests_refresh',
    });
  });
});
