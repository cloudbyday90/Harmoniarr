/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import {
  buildMusicQueueTransferRecoveryActivityPayload,
  buildMusicQueueTransferRecoveryPayload,
  MUSIC_QUEUE_TRANSFER_RECOVERY_STAGES,
} from '../../testing/browser/music-queue-transfer-recovery-browser-fixtures.js';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue transfer recovery browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('refreshes terminal transfer recovery into downloading without a user action', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let releaseReadCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        const stage = MUSIC_QUEUE_TRANSFER_RECOVERY_STAGES[Math.min(releaseReadCount++, MUSIC_QUEUE_TRANSFER_RECOVERY_STAGES.length - 1)];
        await route.fulfill({
          body: JSON.stringify(buildMusicQueueTransferRecoveryPayload(stage)),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueueTransferRecoveryActivityPayload()),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.getByRole('listitem').filter({ hasText: 'Automatic Recovery' });
      const details = page.getByRole('complementary', { name: 'Music Queue details' });

      await releaseRow.getByText('Trying another match', { exact: true }).waitFor();
      await releaseRow.getByText('moving to the next eligible match automatically', { exact: false }).waitFor();
      await releaseRow.getByRole('button', { name: 'View recovery' }).click();
      await details.getByRole('heading', { name: 'Automatic Recovery by Fixture Harbor' }).waitFor();
      await details.getByText('No action is needed. Harmoniarr will continue this release automatically.').waitFor();
      assert.equal(await details.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
      assert.doesNotMatch(await page.getByRole('main').innerText(), /\bcandidate(?:s)?\b/i);

      await releaseRow.getByText('Downloading', { exact: true }).waitFor({ timeout: 15_000 });
      await releaseRow.getByRole('link', { name: 'Open Downloader' }).waitFor();
      await details.getByRole('heading', { name: 'Automatic Recovery by Fixture Harbor' }).waitFor();
      await details.getByText('Downloading', { exact: true }).waitFor();
      assert.ok(releaseReadCount >= 2, 'active recovery must revalidate without pressing Refresh');
      assert.equal(await releaseRow.getByRole('button', { name: 'Review quality choice' }).count(), 0);

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const recoveryStory = page.locator('.activity-timeline-item').filter({
        hasText: 'Trying the next best match: Automatic Recovery by Fixture Harbor',
      });
      await recoveryStory.getByText('Trying the next best match: Automatic Recovery by Fixture Harbor').waitFor();
      await recoveryStory.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
      await recoveryStory.getByRole('link', { name: 'Open Music Queue' }).waitFor();
      assert.doesNotMatch(await recoveryStory.innerText(), /\bcandidate(?:s)?\b/i);
      assert.equal(await recoveryStory.getByRole('link', { name: /diagnostic/i }).count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_terminal_transfer_recovery' });
  });
});
