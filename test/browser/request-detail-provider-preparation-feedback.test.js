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
import { bootstrapAdminThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { createRequesterThroughApi, loginRequesterThroughUi } from '../../testing/browser/user-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

suite('request detail provider preparation feedback', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => {
    await runtime?.cleanup();
  }, { timeout: config.suiteTeardownTimeoutMs });

  test('requester status announces preparation changes without moving keyboard focus or repeating unchanged polls', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) {
      t.skip(unavailableReason);
      return;
    }

    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const requester = await createRequesterThroughApi(page, {
        username: 'preparation-listener',
        password: 'RequesterPass123!',
      });
      await logoutThroughUi(page);
      await loginRequesterThroughUi(page, {
        baseUrl,
        username: requester.username,
        initialPassword: 'RequesterPass123!',
        readyPassword: 'RequesterReady123!',
      });

      const requestId = '11111111-2222-4333-8444-555555555555';
      const detailPath = `/api/v1/library/media-requests/${requestId}`;
      const mediaRequest = {
        id: requestId,
        requestKind: 'external_url',
        requestState: 'needs_fetch',
        sourceProvider: 'spotify',
        sourceUrl: 'https://open.spotify.com/album/fixture',
        createdAt: '2026-09-10T12:00:00.000Z',
        requestedByUser: requester,
        requestedForUser: requester,
        fanOutParentId: 'private-sibling-request-id',
        fulfillmentStatus: {
          code: 'queued',
          label: 'Planning provider request',
          tone: 'held',
          detail: 'Provider preparation is in progress for this request. Music has not been imported yet.',
        },
      };
      let initialResponse;
      const initialResponseGate = new Promise((resolve) => { initialResponse = resolve; });
      let detailReads = 0;
      await browserContext.route(`**${detailPath}`, async (route) => {
        detailReads += 1;
        if (detailReads === 1) await initialResponseGate;
        await route.fulfill({ json: { ok: true, mediaRequest, events: [], hasMoreEvents: false } });
      });
      await browserContext.route(`**${detailPath}/pipeline`, async (route) => {
        await route.fulfill({ json: { ok: true, candidates: [] } });
      });

      await page.clock.install();
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const status = page.getByRole('status', { name: 'Request fulfillment', exact: true });
      await status.waitFor({ state: 'attached' });
      assert.equal(await status.innerText(), '');
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      initialResponse();
      await status.getByText('Planning provider request', { exact: true }).waitFor();

      // Enter the page actions by keyboard, then leave focus on a useful action
      // throughout background polling. No status update should steal it.
      await page.getByRole('button', { name: 'Back' }).focus();
      await page.keyboard.press('Tab');
      const cancelButton = page.getByRole('button', { name: 'Cancel request', exact: true });
      assert.equal(await cancelButton.evaluate((element) => element === globalThis.document.activeElement), true);

      await status.evaluate((element) => {
        globalThis.requestStatusChanges = [];
        globalThis.requestStatusNode = element;
        const observer = new globalThis.MutationObserver(() => {
          globalThis.requestStatusChanges.push(element.textContent.trim());
        });
        observer.observe(element, { childList: true, characterData: true, subtree: true });
      });
      const waitForDetail = () => page.waitForResponse((response) =>
        new URL(response.url()).pathname === detailPath && response.request().method() === 'GET');

      const unchangedResponse = waitForDetail();
      await page.clock.fastForward(15_001);
      await unchangedResponse;
      await page.waitForFunction(() => !globalThis.document.querySelector('.rdl-revalidating'));
      assert.deepEqual(await page.evaluate(() => globalThis.requestStatusChanges), []);

      mediaRequest.fulfillmentStatus = {
        code: 'under_review',
        label: 'Provider details prepared',
        tone: 'held',
        detail: 'Provider details are ready for acquisition review. Music has not been imported yet.',
      };
      const preparedResponse = waitForDetail();
      await page.clock.fastForward(15_001);
      await preparedResponse;
      await status.getByText('Provider details prepared', { exact: true }).waitFor();
      assert.equal(await cancelButton.evaluate((element) => element === globalThis.document.activeElement), true);
      assert.equal(await status.evaluate((element) => element === globalThis.requestStatusNode), true);
      assert.deepEqual(await page.evaluate(() => globalThis.requestStatusChanges), ['Provider details prepared']);
      assert.doesNotMatch(await page.locator('main').innerText(), /\bfulfilled\b|private-sibling-request-id/iu);
      await page.getByText('Provider details are ready for acquisition review. Music has not been imported yet.', { exact: true }).waitFor();
      assert.deepEqual(pageErrors, []);
      await page.goto('about:blank');
    }, { scenarioName: 'request_detail_provider_preparation_feedback' });
  });
});
