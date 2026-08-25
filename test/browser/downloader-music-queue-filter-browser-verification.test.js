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
  buildLinkedDownloaderQueueFixture,
  buildUnlinkedDownloaderTransferFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const defaultQueue = buildLinkedDownloaderQueueFixture();
const twoTransferQueue = buildLinkedDownloaderQueueFixture({
  queueHealth: {
    ...defaultQueue.queueHealth,
    counts: {
      ...defaultQueue.queueHealth.counts,
      queued: 1,
      total: 2,
    },
    message: '1 active and 1 queued transfer are in the queue.',
  },
  sourceGroups: [
    ...defaultQueue.sourceGroups,
    {
      counts: {
        active: 0,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 1,
        total: 1,
      },
      sourceUser: 'queued-slskd-peer',
    },
  ],
  transfers: [
    ...defaultQueue.transfers,
    buildUnlinkedDownloaderTransferFixture(),
  ],
});

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Downloader Music Queue filter browser verification', () => {
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

  test('combines native state and Music Queue linkage filters without changing the queue response', {
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

      await installDownloaderBrowserFixtures(browserContext, { queue: twoTransferQueue });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      const transferQueueCard = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await transferQueueCard.waitFor();
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 2 of 2 transfers.',
      }).waitFor();
      await page.getByText('01 Foil.flac', { exact: true }).waitFor();
      await page.getByText('02 Antarctica Starts Here.flac', { exact: true }).waitFor();

      const stateFilter = page.getByLabel('State');
      const musicQueueLinkedOnly = page.getByRole('checkbox', {
        name: 'Only transfers linked to Music Queue',
      });
      await stateFilter.selectOption('queued');
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 1 of 2 transfers.',
      }).waitFor();
      await page.getByRole('status').filter({
        hasText: 'Showing 1 of 2 transfers.',
      }).waitFor();
      await page.getByText('02 Antarctica Starts Here.flac', { exact: true }).waitFor();

      await musicQueueLinkedOnly.check();
      assert.equal(await musicQueueLinkedOnly.isChecked(), true);
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 0 of 2 transfers.',
      }).waitFor();
      await page.getByRole('status').filter({
        hasText: 'Showing 0 of 2 transfers.',
      }).waitFor();
      await page.getByText('No transfers match these filters', { exact: true }).waitFor();

      await stateFilter.selectOption('active');
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 1 of 2 transfers.',
      }).waitFor();
      const linkedTransferRow = page.getByRole('row').filter({ hasText: '01 Foil.flac' });
      await linkedTransferRow.waitFor();
      await linkedTransferRow.getByRole('link', {
        name: 'Open Music Queue release: Autechre — Amber',
      }).waitFor();

      assert.deepEqual(pageErrors, []);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'downloader_music_queue_linkage_filter',
    });
  });
});
