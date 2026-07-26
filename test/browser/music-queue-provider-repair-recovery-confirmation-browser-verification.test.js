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
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function buildMusicQueuePayload() {
  return {
    checkedAt: '2026-07-26T13:00:00.000Z',
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
        code: 'queued_for_search',
        detail: 'This release is waiting for the next search pass.',
        label: 'Queued for search',
        nextAction: 'search_now',
        tone: 'neutral',
      },
    }],
    summary: { counts: { queued_for_search: 1 }, total: 1 },
  };
}

suite('Music Queue provider repair recovery confirmation browser verification', () => {
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

  test('a saved Connections repair confirms readiness before returning to Music Queue', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let soulseekIsHealthy = false;
      let musicQueueReadCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        musicQueueReadCount += 1;
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            dependencies: [{
              provider: 'slskd',
              status: soulseekIsHealthy ? 'healthy' : 'disabled',
            }],
          }),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const repairNotice = page.locator('.music-queue-provider-repair');
      await repairNotice.getByRole('heading', { name: 'Soulseek needs setup' }).waitFor();
      await Promise.all([
        page.waitForURL(/\/app\/settings\/connections\?repair=music_queue$/),
        repairNotice.getByRole('link', { name: 'Set up Soulseek' }).click(),
      ]);

      soulseekIsHealthy = true;
      await page.getByRole('button', { name: 'Save settings' }).click();

      const confirmation = page.locator('.music-queue-provider-recovery');
      await confirmation.getByRole('heading', { name: 'Soulseek is ready' }).waitFor();
      await confirmation.getByText('Music Queue can continue its normal checks. Harmoniarr has not started a download yet.').waitFor();
      assert.equal(
        await confirmation.getByRole('link', { name: 'Return to Music Queue' }).getAttribute('href'),
        '/app/music-queue?recovery=provider_ready',
      );

      const queueReadCountBeforeReturn = musicQueueReadCount;
      await confirmation.getByRole('link', { name: 'Return to Music Queue' }).click();

      const recoveryVisibility = page.locator('.music-queue-provider-recovery-visibility');
      await recoveryVisibility.getByRole('heading', { name: 'Music Queue is ready' }).waitFor();
      await recoveryVisibility.getByText('Music Has the Right to Children by Boards of Canada is waiting for its next normal search check. Harmoniarr has not started a download yet.').waitFor();
      await page.waitForURL(/\/app\/music-queue$/);
      assert.equal(musicQueueReadCount, queueReadCountBeforeReturn + 1);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_provider_repair_recovery_confirmation' });
  });
});
