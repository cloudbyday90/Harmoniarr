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
  markMetadataMediaRequestCancelled,
  queueMetadataMediaRequestCancellationFailure,
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

async function createRequesterRequestDetail({ baseUrl, browserContext, page, scenarioName }) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  const username = `listener${scenarioName}`;
  await createRequesterThroughApi(page, {
    password: 'RequesterPass123!',
    username,
  });
  await logoutThroughUi(page);
  await loginRequesterThroughUi(page, {
    baseUrl,
    initialPassword: 'RequesterPass123!',
    readyPassword: 'RequesterReady123!',
    username,
  });

  const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
  const confirmRequestDialog = await openRequestConfirmationFromCard(
    page,
    releasesList,
    'Music Has the Right to Children',
  );
  await confirmRequestDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
  await confirmRequestDialog.waitFor({ state: 'hidden' });

  const fixtureState = await readMetadataBrowserFixtureState(page);
  assert.equal(fixtureState.mediaRequests.length, 1);
  const requestId = fixtureState.mediaRequests[0].id;
  assert.equal(fixtureState.mediaRequests[0].requestState, 'needs_fetch');

  await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', {
    exact: true,
    name: 'Boards of Canada \u2014 Music Has the Right to Children',
  }).waitFor();
  await page.getByRole('button', { name: 'Cancel request' }).waitFor();

  return { requestId };
}

async function confirmCancellation(page) {
  await page.getByRole('button', { name: 'Cancel request' }).click();
  const cancelDialog = page.getByRole('alertdialog');
  await cancelDialog.waitFor();
  await cancelDialog.getByRole('heading', { exact: true, name: 'Cancel request?' }).waitFor();
  await cancelDialog.getByRole('button', { name: 'Cancel request' }).press('Enter');
  await cancelDialog.waitFor({ state: 'hidden' });
}

suite('Request Detail cancellation failure and conflict-state browser verification', () => {
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

  test('transient cancellation failures keep the request cancellable and retryable', {
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

      const { requestId } = await createRequesterRequestDetail({
        baseUrl,
        browserContext,
        page,
        scenarioName: 'cancelfailure',
      });
      await queueMetadataMediaRequestCancellationFailure(page, {
        mediaRequestId: requestId,
        message: 'Cancellation service unavailable. Try again.',
        status: 503,
      });

      await confirmCancellation(page);

      await page.getByRole('alert').filter({
        hasText: 'Cancellation service unavailable. Try again.',
      }).waitFor();
      await page.getByRole('button', { name: 'Cancel request' }).waitFor();
      await page.getByText('Waiting for fetch and discovery follow-up.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Request was cancelled.', { exact: true }).count(), 0);

      let fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests[0].id, requestId);
      assert.equal(fixtureState.mediaRequests[0].requestState, 'needs_fetch');

      await confirmCancellation(page);
      await page.getByRole('status').filter({ hasText: 'Request cancelled.' }).waitFor();
      await page.getByText('Request was cancelled.', { exact: true }).first().waitFor();

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests[0].id, requestId);
      assert.equal(fixtureState.mediaRequests[0].requestState, 'cancelled');
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_cancellation_transient_failure',
    });
  });

  test('stale cancellation conflicts show error feedback and refresh to terminal state', {
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

      const { requestId } = await createRequesterRequestDetail({
        baseUrl,
        browserContext,
        page,
        scenarioName: 'cancelconflict',
      });
      await markMetadataMediaRequestCancelled(page, requestId);

      await confirmCancellation(page);

      await page.getByRole('alert').filter({
        hasText: 'This request can no longer be cancelled.',
      }).waitFor();
      const requestJourney = page.getByRole('article').filter({ hasText: 'Request journey' });
      await requestJourney.getByText('Request was cancelled.', { exact: true }).waitFor();
      await requestJourney.getByText('Search was cancelled.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Cancel request' }).count(), 0);

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests[0].id, requestId);
      assert.equal(fixtureState.mediaRequests[0].requestState, 'cancelled');

      await page.goto(`${baseUrl}/app/my-requests`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'My Requests' }).waitFor();
      const requestsList = page.getByRole('list', { name: 'Your requests' });
      await requestsList.getByRole('link', {
        name: 'Music Has the Right to Children by Boards of Canada',
      }).waitFor();
      await requestsList.getByText('Cancelled', { exact: true }).waitFor();
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_cancellation_conflict',
    });
  });
});
