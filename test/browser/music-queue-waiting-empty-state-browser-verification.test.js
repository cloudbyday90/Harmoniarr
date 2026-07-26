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

function buildWaitingPayload() {
  const releases = [{
    artistName: 'Kacey Musgraves',
    expectedTrackCount: 12,
    id: 'wanted-waiting',
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseDate: '2018-03-30T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Golden Hour',
    status: {
      code: 'queued_for_search',
      detail: 'Harmoniarr will search when this release is due.',
      label: 'Waiting to search',
      nextAction: 'review_matches',
      tone: 'neutral',
    },
  }, {
    artistName: 'Lorde',
    expectedTrackCount: 12,
    id: 'wanted-waiting-second',
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseDate: '2021-08-20T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Solar Power',
    status: {
      code: 'queued_for_search',
      detail: 'Harmoniarr will search when this release is due.',
      label: 'Waiting to search',
      nextAction: 'review_matches',
      tone: 'neutral',
    },
  }];

  return {
    checkedAt: '2026-07-26T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: releases.length },
    releases,
    summary: { counts: { queued_for_search: releases.length }, total: releases.length },
  };
}

function buildEmptyPayload() {
  return {
    checkedAt: '2026-07-26T12:01:00.000Z',
    pagination: { limit: 100, offset: 0, total: 0 },
    releases: [],
    summary: { counts: {}, total: 0 },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue waiting and empty-state browser verification', () => {
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

  test('distinguishes automatic waiting from a clear queue without crowding the default path', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_waiting_empty_state',
      });
      const pageErrors = [];
      let queuePayload = buildWaitingPayload();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({ body: JSON.stringify(queuePayload), contentType: 'application/json' });
      });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({ dependencies: [{ provider: 'slskd', status: 'healthy' }] }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({ body: JSON.stringify(payload), contentType: 'application/json', response });
      });

      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const overview = page.locator('.music-queue-overview');
      await overview.getByText('Automatic search', { exact: true }).waitFor();
      await overview.getByRole('heading', { name: '2 releases waiting for automatic search' }).waitFor();
      await overview.getByText('No action is needed. Harmoniarr will search automatically when each release is due.').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Nothing needs your attention' }).count(), 0);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Waiting releases explicitly state that Harmoniarr will continue automatically.',
        name: 'desktop-automatic-waiting',
        surface: 'music-queue',
      });

      queuePayload = buildEmptyPayload();
      await page.reload({ waitUntil: 'domcontentloaded' });
      const emptyState = page.locator('.music-queue-empty-state');
      await emptyState.getByText('Queue is clear', { exact: true }).waitFor();
      await emptyState.getByRole('heading', { name: 'Nothing needs your attention' }).waitFor();
      assert.equal(
        await emptyState.getByRole('link', { name: 'Discover artists' }).getAttribute('href'),
        '/app/discover',
      );
      await page.setViewportSize({ height: 844, width: 390 });
      await page.waitForFunction(() => {
        const sidebar = globalThis.document.querySelector('.hx-sidebar');
        return !sidebar || sidebar.getBoundingClientRect().right <= 0;
      });
      await emptyState.scrollIntoViewIfNeeded();
      assert.equal(
        await page.locator('.hx-main').evaluate((element) => Math.round(element.getBoundingClientRect().left)),
        0,
        'Mobile content should fill the viewport after the desktop sidebar is removed.',
      );
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The clear queue state should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A clear queue gives a calm explanation and one optional next path on mobile.',
        name: 'mobile-clear-queue',
        surface: 'music-queue-empty-state',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
    }, { scenarioName: 'music_queue_waiting_empty_state' });
  });
});
