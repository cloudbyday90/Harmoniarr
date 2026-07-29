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
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

const timelineEvents = Object.freeze([{
  entityArtist: 'Autechre',
  entityId: 'wanted-download',
  entityTitle: 'Amber',
  entityType: 'wanted_release',
  eventType: 'music_queue_download_started',
  extraPayload: { wantedReleaseId: 'wanted-download' },
  id: 'download-started',
  occurredAt: '2026-07-26T22:04:00.000Z',
}, {
  entityArtist: 'Autechre',
  entityId: 'wanted-audio',
  entityTitle: 'Tri Repetae',
  entityType: 'wanted_release',
  eventType: 'music_queue_audio_check_failed',
  extraPayload: { wantedReleaseId: 'wanted-audio' },
  id: 'audio-check-failed',
  occurredAt: '2026-07-26T22:03:00.000Z',
}, {
  entityArtist: 'Autechre',
  entityId: 'release-library',
  entityTitle: 'LP5',
  entityType: 'library_release',
  eventType: 'release_added',
  extraPayload: null,
  id: 'release-added',
  occurredAt: '2026-07-26T22:02:00.000Z',
}, {
  entityArtist: 'Autechre',
  entityId: 'request-1',
  entityTitle: 'Confield',
  entityType: 'media_request',
  eventType: 'request_fulfilled',
  extraPayload: { requestedForUserId: 'another-user', sourceMediaRequestId: 'request-1' },
  id: 'request-fulfilled',
  occurredAt: '2026-07-26T22:01:00.000Z',
}]);

const systemHistoryEntries = Object.freeze([{
  entryType: 'operation_run',
  id: 'system-history-1',
  message: 'Library scan completed',
  occurredAt: '2026-07-26T22:00:00.000Z',
  status: 'completed',
  title: 'Library scan',
}]);

function buildTimelinePayload() {
  return {
    checkedAt: '2026-07-26T22:05:00.000Z',
    events: timelineEvents,
    ok: true,
    total: timelineEvents.length,
  };
}

function buildSystemHistoryPayload() {
  return {
    checkedAt: '2026-07-26T22:05:00.000Z',
    entries: systemHistoryEntries,
    ok: true,
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Activity history initial-load browser verification', () => {
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

  test('loads direct Activity routes without a false empty state and keeps normal handoffs scoped to the release or destination', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let resolveInitialTimelineRequest;
      let systemHistoryRequestCount = 0;
      let timelineRequestCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        timelineRequestCount += 1;
        if (timelineRequestCount === 1) {
          await new Promise((resolve) => {
            resolveInitialTimelineRequest = resolve;
          });
        }
        await route.fulfill({
          body: JSON.stringify(buildTimelinePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/system\/activity-feed(?:\?.*)?$/, async (route) => {
        systemHistoryRequestCount += 1;
        await route.fulfill({
          body: JSON.stringify(buildSystemHistoryPayload()),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/activity`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/app\/activity\/feed$/);
      await page.getByRole('heading', { exact: true, name: 'Activity timeline' }).waitFor();
      await page.getByText('Loading recent activity...').waitFor();
      assert.equal(await page.getByText('Nothing to show yet').count(), 0);

      resolveInitialTimelineRequest();
      await page.getByText('Download started: Amber by Autechre').waitFor();
      assert.equal(timelineRequestCount, 1);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('Download started: Amber by Autechre').waitFor();
      assert.equal(timelineRequestCount, 2, 'Reload should make a fresh Activity request.');

      await page.getByLabel('Show activity').selectOption('downloads');
      const downloadEntry = page.locator('.activity-timeline-item').filter({
        hasText: 'Download started: Amber by Autechre',
      });
      await downloadEntry.getByRole('link', { name: 'Open Music Queue' }).waitFor();
      assert.match(
        await downloadEntry.getByRole('link', { name: 'Open Music Queue' }).getAttribute('href'),
        /\/app\/music-queue\/wanted-download$/,
      );
      assert.equal(await page.locator('.activity-timeline > .activity-timeline-item').count(), 1);

      await page.getByLabel('Show activity').selectOption('audio_checks');
      const audioEntry = page.locator('.activity-timeline-item').filter({
        hasText: 'Audio check could not run: Tri Repetae by Autechre',
      });
      await audioEntry.getByRole('link', { name: 'Check connections' }).waitFor();
      assert.match(
        await audioEntry.getByRole('link', { name: 'Check connections' }).getAttribute('href'),
        /\/app\/settings\/connections$/,
      );

      await page.getByLabel('Show activity').selectOption('library');
      const libraryEntry = page.locator('.activity-timeline-item').filter({
        hasText: 'LP5 by Autechre added to library',
      });
      await libraryEntry.getByRole('link', { name: 'Open Library' }).waitFor();
      assert.match(
        await libraryEntry.getByRole('link', { name: 'Open Library' }).getAttribute('href'),
        /\/app\/library$/,
      );

      await page.getByLabel('Show activity').selectOption('requests');
      const requestEntry = page.locator('.activity-timeline-item').filter({
        hasText: 'Confield by Autechre added to library',
      });
      await requestEntry.getByRole('link', { name: 'Open request' }).waitFor();
      assert.match(
        await requestEntry.getByRole('link', { name: 'Open request' }).getAttribute('href'),
        /\/app\/requests\/request-1$/,
      );
      assert.equal(await requestEntry.getByRole('link', { name: /diagnostic/i }).count(), 0);

      await page.goto(`${baseUrl}/app/activity/history`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'History' }).waitFor();
      await page.getByRole('cell', { exact: true, name: 'Library scan' }).waitFor();
      assert.equal(systemHistoryRequestCount, 1);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('cell', { exact: true, name: 'Library scan' }).waitFor();
      assert.equal(systemHistoryRequestCount, 2, 'Reload should make a fresh system-history request.');
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'activity_history_initial_load' });
  });
});
