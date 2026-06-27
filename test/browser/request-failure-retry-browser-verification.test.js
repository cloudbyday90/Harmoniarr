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
  markMetadataReleaseRequestLinked,
  queueMetadataMediaRequestFailure,
  readMetadataBrowserFixtureState,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
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

suite('Request failure and retry-state browser verification', () => {
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

  test('request failures keep dialogs retryable and linked responses still resolve to requested state', {
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

      await queueMetadataMediaRequestFailure(page, {
        code: 'fixture_request_failed',
        message: 'Fixture request failed. Try again.',
        releaseTitle: 'Music Has the Right to Children',
        requestKey: 'release:mb-release-mhtrtc',
        status: 503,
      });
      let fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequestFailures.length, 1);

      const confirmDialog = await openRequestConfirmationFromCard(
        page,
        releasesList,
        'Music Has the Right to Children',
      );
      await assertFocusWithin(confirmDialog, 'Request confirmation should keep focus in the dialog after opening');
      const requestForSelect = confirmDialog.getByLabel('Request for');
      await requestForSelect.selectOption('fixture-listener-user');
      const confirmButton = confirmDialog.getByRole('button', { name: 'Confirm request' });
      await confirmButton.press('Enter');

      await confirmDialog.getByRole('alert').filter({
        hasText: 'Fixture request failed. Try again.',
      }).waitFor();
      await assertFocusWithin(confirmDialog, 'Failed card request should keep focus in the confirmation dialog');
      assert.equal(await requestForSelect.inputValue(), 'fixture-listener-user');
      assert.equal(await confirmButton.isEnabled(), true, 'Failed card request should leave Confirm request enabled');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 0, 'Failed card request should not record a request');

      await confirmButton.press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });
      const requestedCardButton = releasesList.getByRole('button', {
        name: 'Music Has the Right to Children — already requested',
      });
      await requestedCardButton.waitFor();
      assert.equal(await requestedCardButton.getAttribute('disabled'), '');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 1);
      assert.equal(fixtureState.mediaRequests[0].requestedForUserId, 'fixture-listener-user');
      assert.equal(fixtureState.mediaRequests[0].linked, false);

      await markMetadataReleaseRequestLinked(page, 'release:mb-release-amber');
      const linkedDialog = await openRequestConfirmationFromCard(page, releasesList, 'Amber');
      const linkedConfirmButton = linkedDialog.getByRole('button', { name: 'Confirm request' });
      await linkedConfirmButton.press('Enter');
      await linkedDialog.waitFor({ state: 'hidden' });
      await releasesList.getByRole('button', { name: 'Amber — already requested' }).waitFor();

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 2);
      const linkedRequest = fixtureState.mediaRequests.find((request) => request.releaseTitle === 'Amber');
      assert.ok(linkedRequest, 'Expected fixture to record linked Amber request');
      assert.equal(linkedRequest.linked, true);

      await queueMetadataMediaRequestFailure(page, {
        code: 'fixture_release_detail_failed',
        message: 'Release Detail request failed. Retry is available.',
        releaseTitle: 'Geogaddi',
        requestKey: 'release:mb-release-geogaddi',
        status: 500,
      });

      const { dialog: releaseDetailDialog, geogaddiCard } = await openGeogaddiReleaseDetail(page, baseUrl);
      const detailRequestForSelect = releaseDetailDialog.getByLabel('For', { exact: true });
      await detailRequestForSelect.selectOption('fixture-listener-user');
      const detailRequestButton = releaseDetailDialog.getByRole('button', { name: 'Request', exact: true });
      await detailRequestButton.focus();
      await detailRequestButton.press('Enter');

      await releaseDetailDialog.getByRole('alert').filter({
        hasText: 'Release Detail request failed. Retry is available.',
      }).waitFor();
      await assertFocusWithin(releaseDetailDialog, 'Failed Release Detail request should keep focus in the dialog');
      assert.equal(await detailRequestForSelect.inputValue(), 'fixture-listener-user');
      assert.equal(await detailRequestButton.isEnabled(), true, 'Failed Release Detail request should leave Request enabled');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 2, 'Failed Release Detail request should not record a request');

      await detailRequestButton.press('Enter');
      await releaseDetailDialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(geogaddiCard, 'Successful retry from Release Detail should restore focus to the opener');

      fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.mediaRequests.length, 3);
      const geogaddiRequest = fixtureState.mediaRequests.find((request) => request.releaseTitle === 'Geogaddi');
      assert.ok(geogaddiRequest, 'Expected fixture to record Geogaddi after retry');
      assert.equal(geogaddiRequest.requestedForUserId, 'fixture-listener-user');
      assert.equal(geogaddiRequest.linked, false);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_failure_retry_browser_verification',
    });
  });
});
