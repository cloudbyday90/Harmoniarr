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
import { bootstrapAdminThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
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
import { createRequesterThroughApi, loginRequesterThroughUi } from '../../testing/browser/user-browser-helpers.js';
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
      const confirmCancelButton = confirmDialog.getByRole('button', { name: 'Cancel' });
      await assertLocatorFocused(confirmCancelButton, 'Confirm Request should move initial focus to Cancel');
      await assertTabFocusContained(page, confirmDialog, { steps: 5 });
      await assertFocusWithin(confirmDialog, 'Confirm Request tab sequence should remain in the dialog');
      await confirmDialog.getByLabel('Request for').selectOption('fixture-listener-user');
      const confirmButton = confirmDialog.getByRole('button', { name: 'Confirm request' });
      await confirmButton.focus();
      await confirmButton.press('Enter');
      await confirmDialog.waitFor({ state: 'hidden' });

      // A request for another listener must not disable the session user's card action.
      await cardRequestButton.waitFor();
      assert.equal(await cardRequestButton.isEnabled(), true);
      await cardRequestButton.click();
      await confirmDialog.waitFor();
      assert.equal(await confirmDialog.getByRole('button', { name: 'Confirm request' }).isEnabled(), true);
      await confirmDialog.getByLabel('Request for').selectOption('fixture-listener-user');
      assert.equal(await confirmDialog.getByRole('button', { name: 'Requested', exact: true }).isDisabled(), true);
      await confirmDialog.getByLabel('Request for').selectOption({ label: 'Myself' });
      await confirmDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

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
  for (const surface of ['activity', 'requester-home']) {
    test(`${surface} keeps confirmation controls locked during submission and restores retry`, {
      timeout: integrationRuntimeConfig.scenarioTimeoutMs,
    }, async (t) => {
      if (runtimeUnavailableReason) {
        t.skip(runtimeUnavailableReason);
        return;
      }
      await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
        await installMetadataBrowserFixtures(browserContext);
        await bootstrapAdminThroughUi(page, { baseUrl });
        if (surface === 'requester-home') {
          await createRequesterThroughApi(page, { username: 'listener', password: 'RequesterPass123!' });
          await logoutThroughUi(page);
          await loginRequesterThroughUi(page, {
            baseUrl, beforeReadyNavigation: markBoardsOfCanadaAddedInMetadataBrowserFixture, username: 'listener', initialPassword: 'RequesterPass123!', readyPassword: 'RequesterReady123!',
          });
        }
        await page.route('**/api/v1/library/release-radar*', (route) => route.fulfill({
          json: { recent: [{ musicbrainzReleaseGroupId: 'mb-rg-pending', releaseGroupTitle: 'Pending release', artistName: 'Fixture artist' }], upcoming: [] },
        }));
        await page.goto(`${baseUrl}/app${surface === 'activity' ? '/activity/releases' : ''}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Request Pending release', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Request this release?' });
        const recipient = dialog.getByLabel('Request for');
        if (surface === 'activity') await recipient.selectOption('fixture-listener-user');
        else assert.equal(await recipient.count(), 0);
        await page.evaluate(() => {
          const originalFetch = globalThis.fetch.bind(globalThis);
          globalThis.__recipientRequestStarted = false;
          const gate = new Promise((resolve) => { globalThis.__releaseRecipientResponse = resolve; });
          globalThis.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input.url;
            if (url.endsWith('/api/v1/library/media-requests') && init?.method === 'POST') {
              globalThis.__recipientRequestStarted = true;
              await gate;
              return new Response(JSON.stringify({ error: { message: 'Please retry this request.' } }), {
                status: 503, headers: { 'content-type': 'application/json' },
              });
            }
            return originalFetch(input, init);
          };
        });
        await dialog.getByRole('button', { name: 'Confirm request' }).click();
        await page.waitForFunction(() => globalThis.__recipientRequestStarted);
        try {
          assert.equal(await dialog.getByRole('button', { name: 'Requesting…' }).isDisabled(), true);
          assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
          if (surface === 'activity') assert.equal(await recipient.isDisabled(), true);
          await page.keyboard.press('Escape');
          assert.equal(await dialog.isVisible(), true);
        } finally {
          await page.evaluate(() => globalThis.__releaseRecipientResponse());
        }
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.getByRole('button', { name: 'Confirm request' }).isEnabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isEnabled(), true);
        if (surface === 'activity') {
          assert.equal(await recipient.isEnabled(), true);
          assert.equal(await recipient.inputValue(), 'fixture-listener-user');
        }
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }, { scenarioName: `request_pending_${surface}` });
    });
  }

});
