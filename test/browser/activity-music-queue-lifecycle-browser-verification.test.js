/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
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

suite('Activity Music Queue lifecycle browser verification', () => {
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

  test('automatic recovery is readable, filterable, and links back to Music Queue', {
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
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            checkedAt: '2026-07-25T22:00:00.000Z',
            ok: true,
            total: 3,
            events: [{
              id: 'event-retrying',
              eventType: 'music_queue_match_retrying',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-1',
              entityTitle: 'Music Has the Right to Children',
              entityType: 'wanted_release',
              extraPayload: { wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-25T21:59:00.000Z',
            }, {
              id: 'event-exhausted',
              eventType: 'music_queue_no_matches_left',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-2',
              entityTitle: 'Geogaddi',
              entityType: 'wanted_release',
              extraPayload: { rediscoveryScheduled: true, wantedReleaseId: 'wanted-2' },
              occurredAt: '2026-07-25T21:58:00.000Z',
            }, {
              id: 'event-terminal',
              eventType: 'music_queue_download_failed',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-3',
              entityTitle: 'The Campfire Headphase',
              entityType: 'wanted_release',
              extraPayload: { wantedReleaseId: 'wanted-3' },
              occurredAt: '2026-07-25T21:57:00.000Z',
            }],
          }),
        });
      });

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Recent activity' }).waitFor();
      await page.getByText('Trying the next best match: Music Has the Right to Children by Boards of Canada').waitFor();
      await page.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
      await page.getByText('No good matches left: Geogaddi by Boards of Canada').waitFor();
      await page.getByText('Harmoniarr will search again later.').waitFor();

      await page.getByLabel('Show activity').selectOption('needs_attention');
      await page.getByText('Download needs attention: The Campfire Headphase by Boards of Canada').waitFor();
      await page.getByText('Trying the next best match: Music Has the Right to Children by Boards of Canada').waitFor({ state: 'hidden' });

      await page.getByLabel('Show activity').selectOption('downloads');
      const recovery = page.getByRole('listitem').filter({
        hasText: 'Trying the next best match: Music Has the Right to Children by Boards of Canada',
      });
      await recovery.waitFor();
      await recovery.getByRole('link', { name: 'Open Music Queue' }).waitFor();
      assert.equal(await recovery.getByRole('link', { name: 'Open Music Queue' }).count(), 1);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'activity_music_queue_lifecycle' });
  });

  test('routine Music Queue progress is one expandable release story', {
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
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            checkedAt: '2026-07-26T12:05:00.000Z',
            ok: true,
            total: 5,
            events: [{
              id: 'release-added',
              eventType: 'release_added',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-1',
              entityTitle: 'Music Has the Right to Children',
              entityType: 'wanted_release',
              extraPayload: { wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-26T12:04:00.000Z',
            }, {
              id: 'download-started',
              eventType: 'music_queue_download_started',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-1',
              entityTitle: 'Music Has the Right to Children',
              entityType: 'wanted_release',
              extraPayload: { queuedFileCount: 8, wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-26T12:03:00.000Z',
            }, {
              id: 'match-selected',
              eventType: 'music_queue_match_selected',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-1',
              entityTitle: 'Music Has the Right to Children',
              entityType: 'wanted_release',
              extraPayload: { selectionMode: 'automatic', wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-26T12:02:00.000Z',
            }, {
              id: 'search-started',
              eventType: 'music_queue_search_started',
              entityArtist: 'Boards of Canada',
              entityId: 'wanted-1',
              entityTitle: 'Music Has the Right to Children',
              entityType: 'wanted_release',
              extraPayload: { wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-26T12:01:00.000Z',
            }, {
              id: 'artist-monitored',
              eventType: 'artist_monitored',
              entityTitle: 'Autechre',
              occurredAt: '2026-07-26T12:00:00.000Z',
            }],
          }),
        });
      });

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Recent activity' }).waitFor();

      const story = page.locator('.activity-timeline-item').filter({
        hasText: 'Music Has the Right to Children',
      });
      await story.getByRole('link', { name: 'Open Library' }).waitFor();
      assert.equal(
        (await page.locator('.activity-feed-status').textContent()).replace(/\s+/g, ' ').trim(),
        'Showing 2 timeline items from 5 events in all activity.',
      );
      assert.equal(await page.locator('.activity-timeline > .activity-timeline-item').count(), 2);
      await story.locator('summary').click();
      await story.getByText('Searching again: Music Has the Right to Children by Boards of Canada').waitFor();
      await story.getByText('Match selected: Music Has the Right to Children by Boards of Canada').waitFor();
      await story.getByText('Download started: Music Has the Right to Children by Boards of Canada').waitFor();

      await page.getByLabel('Show activity').selectOption('downloads');
      await page.locator('.activity-timeline > .activity-timeline-item').waitFor();
      assert.equal(
        (await page.locator('.activity-feed-status').textContent()).replace(/\s+/g, ' ').trim(),
        'Showing 1 timeline item from 3 events in downloads.',
      );
      assert.equal(await page.locator('.activity-timeline > .activity-timeline-item').count(), 1);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'activity_music_queue_release_story' });
  });
});
