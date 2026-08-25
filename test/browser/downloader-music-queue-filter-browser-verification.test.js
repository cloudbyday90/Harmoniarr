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
const additionalLinkedTransfer = {
  ...defaultQueue.transfers[0],
  diagnostics: {
    ...defaultQueue.transfers[0].diagnostics,
    importLinkage: {
      ...defaultQueue.transfers[0].diagnostics.importLinkage,
      musicQueueRelease: {
        ...defaultQueue.transfers[0].diagnostics.importLinkage.musicQueueRelease,
        releaseTitle: 'Tri Repetae',
        wantedReleaseId: 'wanted-release-downloader-linked-second',
      },
    },
  },
  directory: 'Autechre\\Tri Repetae',
  filename: 'Autechre\\Tri Repetae\\02 Eutow.flac',
  id: 'transfer-downloader-linked-second',
  sourceUser: 'second-healthy-slskd-peer',
  transferKey: 'second-healthy-slskd-peer::transfer-downloader-linked-second',
};
const fourTransferQueue = buildLinkedDownloaderQueueFixture({
  queueHealth: {
    ...defaultQueue.queueHealth,
    counts: {
      ...defaultQueue.queueHealth.counts,
      active: 2,
      queued: 2,
      total: 4,
    },
    message: '2 active and 2 queued transfers are in the queue.',
  },
  sourceGroups: [
    {
      counts: {
        active: 2,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 2,
      },
      sourceUser: 'healthy-slskd-peer',
    },
    {
      counts: {
        active: 0,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 2,
        total: 2,
      },
      sourceUser: 'queued-slskd-peer',
    },
  ],
  transfers: [
    ...defaultQueue.transfers,
    additionalLinkedTransfer,
    buildUnlinkedDownloaderTransferFixture(),
    buildUnlinkedDownloaderTransferFixture({
      directory: 'Biosphere\\Substrata',
      filename: 'Biosphere\\Substrata\\04 Hyperborea.flac',
      id: 'transfer-downloader-unlinked-second',
      placeInQueue: 2,
      transferKey: 'queued-slskd-peer::transfer-downloader-unlinked-second',
    }),
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

      await installDownloaderBrowserFixtures(browserContext, { queue: fourTransferQueue });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      const transferQueueCard = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await transferQueueCard.waitFor();
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 4 of 4 transfers.',
      }).waitFor();
      await page.getByText('01 Foil.flac', { exact: true }).waitFor();
      await page.getByText('02 Eutow.flac', { exact: true }).waitFor();
      await page.getByText('02 Antarctica Starts Here.flac', { exact: true }).waitFor();
      await page.getByText('04 Hyperborea.flac', { exact: true }).waitFor();

      const stateFilter = page.getByLabel('State');
      const musicQueueLinkedOnly = page.getByRole('checkbox', {
        name: 'Only transfers linked to Music Queue',
      });
      await stateFilter.selectOption('queued');
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 2 of 4 transfers.',
      }).waitFor();
      await page.getByRole('status').filter({
        hasText: 'Showing 2 of 4 transfers.',
      }).waitFor();
      await page.getByText('02 Antarctica Starts Here.flac', { exact: true }).waitFor();

      await musicQueueLinkedOnly.check();
      assert.equal(await musicQueueLinkedOnly.isChecked(), true);
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 0 of 4 transfers.',
      }).waitFor();
      await page.getByRole('status').filter({
        hasText: 'Showing 0 of 4 transfers.',
      }).waitFor();
      await page.getByText('No transfers match these filters', { exact: true }).waitFor();

      await stateFilter.selectOption('active');
      await transferQueueCard.locator('.hx-card-subtitle').filter({
        hasText: 'Showing 2 of 4 transfers.',
      }).waitFor();
      const linkedTransferRow = page.getByRole('row').filter({ hasText: '01 Foil.flac' });
      await linkedTransferRow.waitFor();
      await linkedTransferRow.getByRole('link', {
        name: 'Open Music Queue release: Autechre — Amber',
      }).waitFor();

      await page.evaluate(() => {
        const fetchBeforeRefresh = globalThis.fetch;
        let queueRefreshCount = 0;

        globalThis.fetch = async (...args) => {
          const [input, init] = args;
          const requestUrl = typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
          const url = new URL(requestUrl, globalThis.location.origin);
          const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();

          if (method === 'GET' && url.pathname === '/api/v1/downloader/queue') {
            queueRefreshCount += 1;
          }

          return fetchBeforeRefresh(...args);
        };

        globalThis.__harmoniarrDownloaderFixture = {
          getQueueRefreshCount: () => queueRefreshCount,
        };
      });
      await page.getByRole('button', { exact: true, name: 'Refresh' }).click();
      await page.waitForFunction(() => (
        globalThis.__harmoniarrDownloaderFixture.getQueueRefreshCount() === 1
      ));
      const refreshedTransferCount = await page.evaluate(() => (
        globalThis.__harmoniarrDownloaderFixture.getQueueRefreshCount()
      ));
      assert.equal(
        refreshedTransferCount,
        1,
      );
      assert.equal(await musicQueueLinkedOnly.isChecked(), true);
      assert.equal(await transferQueueCard.getByRole('row').count(), 3);

      await page.setViewportSize({ width: 375, height: 812 });
      const narrowLayout = await page.evaluate(() => {
        const viewportWidth = globalThis.innerWidth;
        const toBox = (element) => {
          const { height, left, right, width } = element.getBoundingClientRect();
          return { height, left, right, width };
        };
        const transferQueue = globalThis.document.querySelector('.downloader-transfer-queue');

        return {
          actionButtons: Array.from(globalThis.document.querySelectorAll('.hx-page-actions > *')).map(toBox),
          filterControls: Array.from(globalThis.document.querySelectorAll(
            '.downloader-transfer-filters select, .downloader-transfer-filter-linkage',
          )).map(toBox),
          headerFlexDirection: globalThis.getComputedStyle(
            transferQueue.querySelector('.hx-card-header'),
          ).flexDirection,
          statCards: Array.from(globalThis.document.querySelectorAll('.hx-stat-grid > *')).map(toBox),
          tableElement: transferQueue.querySelector('.hx-table')?.tagName,
          viewportWidth,
        };
      });
      assert.equal(narrowLayout.headerFlexDirection, 'column');
      assert.equal(narrowLayout.tableElement, 'TABLE');
      assert.ok(narrowLayout.actionButtons.every((box) => (
        box.height >= 44 && box.left >= 0 && box.right <= narrowLayout.viewportWidth
      )));
      assert.ok(narrowLayout.statCards.every((box) => (
        box.left >= 0 && box.right <= narrowLayout.viewportWidth
      )));
      assert.ok(narrowLayout.filterControls.every((box) => (
        box.left >= 0 && box.right <= narrowLayout.viewportWidth
      )));
      assert.equal(narrowLayout.filterControls[0].width, narrowLayout.filterControls[1].width);

      assert.deepEqual(pageErrors, []);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'downloader_music_queue_linkage_filter',
    });
  });
});
