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
import {
  createBrowserVisualEvidenceRecorder,
  stabilizeVisualEvidencePage,
} from '../../testing/browser/visual-evidence.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

const activityEvents = Object.freeze([
  {
    id: 'release-added',
    eventType: 'release_added',
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    extraPayload: { wantedReleaseId: 'wanted-1' },
    occurredAt: '2026-07-26T12:04:00.000Z',
  },
  {
    id: 'download-started',
    eventType: 'music_queue_download_started',
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    extraPayload: { wantedReleaseId: 'wanted-1' },
    occurredAt: '2026-07-26T12:03:00.000Z',
  },
  {
    id: 'match-selected',
    eventType: 'music_queue_match_selected',
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    extraPayload: { selectionMode: 'automatic', wantedReleaseId: 'wanted-1' },
    occurredAt: '2026-07-26T12:02:00.000Z',
  },
  {
    id: 'search-started',
    eventType: 'music_queue_search_started',
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    extraPayload: { wantedReleaseId: 'wanted-1' },
    occurredAt: '2026-07-26T12:01:00.000Z',
  },
  {
    id: 'quality-blocked',
    eventType: 'music_queue_quality_blocked',
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-2',
    entityTitle: 'Geogaddi',
    entityType: 'wanted_release',
    extraPayload: {
      blockerMessage: 'Audio is not verified lossless.',
      wantedReleaseId: 'wanted-2',
    },
    occurredAt: '2026-07-26T11:57:00.000Z',
  },
  {
    id: 'artist-policy-saved',
    eventType: 'artist_policy_saved',
    entityArtist: 'Boards of Canada',
    entityId: 'artist-1',
    entityTitle: 'Boards of Canada',
    entityType: 'artist',
    occurredAt: '2026-07-26T11:55:00.000Z',
  },
]);

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Activity information hierarchy browser verification', () => {
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

  test('keeps normal history quiet while making repair states obvious at desktop and mobile widths', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'activity_information_hierarchy',
      });
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
            events: activityEvents,
            ok: true,
            total: activityEvents.length,
          }),
        });
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Activity timeline' }).waitFor();
      await page.getByLabel('Show activity').waitFor();
      await page.getByText(/Music Has the Right to Children.*added to library/).first().waitFor();
      await page.getByText('Quality choice needed: Geogaddi by Boards of Canada').waitFor();
      const attentionSection = page.locator('.activity-timeline-section--attention');
      await attentionSection.getByRole('heading', { exact: true, name: 'Needs attention' }).waitFor();
      await attentionSection.getByText('Quality choice needed: Geogaddi by Boards of Canada').waitFor();
      await attentionSection.getByRole('link', { name: 'Review quality choice' }).waitFor();
      assert.equal(await attentionSection.getByText('Music Has the Right to Children', { exact: false }).count(), 0);
      assert.equal(await page.locator('.activity-timeline-section').count(), 2);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Actionable release stops appear before quiet routine history and secondary diagnostics.',
        name: 'desktop-default-timeline',
        surface: 'activity-timeline',
      });

      await page.getByLabel('Show activity').selectOption('needs_attention');
      await page.getByText('Quality choice needed: Geogaddi by Boards of Canada').waitFor();
      assert.equal(await page.locator('.activity-timeline > .activity-timeline-item').count(), 1);
      assert.match(
        (await page.locator('.activity-feed-status').textContent()).replace(/\s+/g, ' ').trim(),
        /^Showing 1 timeline item from 1 event in needs attention\.$/,
      );

      await page.setViewportSize({ height: 844, width: 390 });
      await page.getByLabel('Show activity').waitFor();
      await evidence.capture(page, {
        description: 'The attention filter remains readable and operable at a mobile width.',
        name: 'mobile-attention-filter',
        surface: 'activity-timeline',
      });
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'activity_information_hierarchy' });
  });
});
