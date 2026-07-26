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
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function buildMusicQueuePayload() {
  return {
    checkedAt: '2026-07-26T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Boards of Canada',
      expectedTrackCount: 12,
      id: 'wanted-boards-search',
      missingTrackCount: 12,
      releaseGroupTitle: 'Music Has the Right to Children',
      releaseGroupType: 'Album',
      releaseTitle: 'Music Has the Right to Children',
      status: {
        code: 'searching',
        detail: 'Harmoniarr is looking for an acceptable match.',
        label: 'Searching',
        nextAction: 'review_matches',
        tone: 'info',
      },
    }],
    summary: { counts: { searching: 1 }, total: 1 },
  };
}

suite('Music Queue provider repair context browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('Home and Music Queue show one bounded managed setup handoff for active queue work', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            dependencies: [{
              message: 'Soulseek is connected and ready for downloads.',
              provider: 'slskd',
              status: 'healthy',
            }],
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'managed',
          providerModeState: 'managed_deployment_missing',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
      const homeNotice = page.locator('.music-queue-provider-repair');
      await homeNotice.getByRole('heading', { name: 'Managed setup required' }).waitFor();
      await homeNotice.getByText('Finish the managed setup before queued music can continue.').waitFor();
      assert.equal(
        await homeNotice.getByRole('link', { name: 'Finish managed setup' }).getAttribute('href'),
        '/app/settings/connections',
      );

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const queueNotice = page.locator('.music-queue-provider-repair');
      await queueNotice.getByRole('heading', { name: 'Managed setup required' }).waitFor();
      assert.equal(await queueNotice.count(), 1);
      assert.equal(
        await queueNotice.getByRole('link', { name: 'Finish managed setup' }).getAttribute('href'),
        '/app/settings/connections',
      );
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_provider_repair_context' });
  });
});
