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
  readMetadataBrowserFixtureState,
  seedMetadataMediaRequestEvents,
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

async function createRequesterRequest({ baseUrl, browserContext, page, scenarioName }) {
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
  assert.equal(fixtureState.mediaRequests[0].requestState, 'needs_fetch');

  return {
    requestId: fixtureState.mediaRequests[0].id,
    username,
  };
}

suite('Requester Request Detail event timeline browser verification', () => {
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

  test('event history renders requester-safe copy and paginates older events', {
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

      const { requestId, username } = await createRequesterRequest({
        baseUrl,
        browserContext,
        page,
        scenarioName: 'eventtimeline',
      });

      await markMetadataMediaRequestCancelled(page, requestId);
      await seedMetadataMediaRequestEvents(page, requestId, {
        events: [
          {
            actorUsername: username,
            eventType: 'cancelled',
            id: 'fixture-event-cancelled',
            occurredAt: '2026-06-25T17:02:00.000Z',
            reason: 'Found another source',
          },
          {
            actorUsername: username,
            eventType: 'created',
            id: 'fixture-event-created',
            occurredAt: '2026-06-25T17:00:00.000Z',
          },
        ],
        nextCursor: 'older-request-events',
        pages: {
          'older-request-events': {
            events: [
              {
                actorUsername: 'admin',
                eventType: 'reassigned',
                id: 'fixture-event-reassigned',
                newRequestedForUserId: 'fixture-listener-user-id',
                occurredAt: '2026-06-25T16:59:00.000Z',
                previousRequestedForUserId: 'fixture-admin-user-id',
                reason: 'Request owner corrected',
              },
            ],
            nextCursor: null,
          },
        },
      });

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', {
        exact: true,
        name: 'Boards of Canada \u2014 Music Has the Right to Children',
      }).waitFor();

      const eventHistory = page.getByRole('list', { name: 'Request event history' });
      await eventHistory.waitFor();
      await eventHistory.getByText('Cancelled', { exact: true }).waitFor();
      await eventHistory.getByText(`${username} cancelled this request. Reason: Found another source`, {
        exact: true,
      }).waitFor();
      await eventHistory.getByText('Created', { exact: true }).waitFor();
      await eventHistory.getByText(`${username} created this request`, { exact: true }).waitFor();
      assert.equal(await eventHistory.getByRole('listitem').count(), 2);
      assert.equal(await page.getByText('fixture-admin-user-id').count(), 0);
      assert.equal(await page.getByText('fixture-listener-user-id').count(), 0);

      await page.getByRole('button', { name: 'Load more events' }).click();
      await eventHistory.getByText('Reassigned', { exact: true }).waitFor();
      await eventHistory.getByText(
        'admin reassigned from previous requester to new requester. Reason: Request owner corrected',
        { exact: true },
      ).waitFor();
      assert.equal(await eventHistory.getByRole('listitem').count(), 3);
      assert.equal(await page.getByRole('button', { name: 'Load more events' }).count(), 0);
      assert.equal(await page.getByText('fixture-admin-user-id').count(), 0);
      assert.equal(await page.getByText('fixture-listener-user-id').count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_event_timeline',
    });
  });
});
