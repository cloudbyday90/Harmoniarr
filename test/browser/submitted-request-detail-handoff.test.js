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
  assertLocatorFocused,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  openRequestConfirmationFromCard,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Submitted-request detail handoff browser verification', () => {
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

  test('requesters can open a newly submitted My Requests card into request detail', {
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
      const confirmDialog = await openRequestConfirmationFromCard(
        page,
        releasesList,
        'Music Has the Right to Children',
      );
      await confirmDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 1);
      const requestId = fixtureState.mediaRequests[0].id;
      assert.equal(requestId, 'fixture-media-request-1');

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();

      const requestsList = page.getByRole('list', { name: 'Your requests' });
      const submittedRequest = requestsList.getByRole('link', {
        name: 'Music Has the Right to Children by Boards of Canada',
      });
      await submittedRequest.waitFor();
      await submittedRequest.focus();
      await assertLocatorFocused(submittedRequest, 'Submitted My Requests card should be keyboard focusable');
      await submittedRequest.press('Enter');

      await page.waitForURL(new RegExp(`/app/requests/${requestId}$`, 'u'));
      await page.getByRole('heading', {
        exact: true,
        name: 'Boards of Canada \u2014 Music Has the Right to Children',
      }).waitFor();
      await page.getByText('Release request').waitFor();
      await page.getByRole('heading', { exact: true, name: 'Request journey' }).waitFor();
      await page.getByText('Finding sources', { exact: true }).waitFor();
      await page.getByText('Searching Soulseek for matching sources.', { exact: true }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Request details' }).waitFor();
      await page.getByText('Boards of Canada', { exact: true }).waitFor();
      await page.getByText('Music Has the Right to Children', { exact: true }).waitFor();
      await page.getByText('listener (Requester)').waitFor();
      await page.getByRole('heading', { exact: true, name: 'Fulfillment pipeline' }).waitFor();
      await page.getByText('No import candidates are linked to this request yet.').waitFor();
      await page.getByText('Harmoniarr will show download and import progress here after discovery finds a usable source.').waitFor();

      assert.equal(await page.getByText('Requested for').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reassign' }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Open in import review' }).count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'submitted_request_detail_handoff',
    });
  });
});
