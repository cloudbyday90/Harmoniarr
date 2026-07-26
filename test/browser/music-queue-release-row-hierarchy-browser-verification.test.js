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

function buildMusicQueuePayload() {
  const releases = [{
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: 'wanted-downloading',
    matchedTrackCount: 4,
    missingTrackCount: 8,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseDate: '2024-01-01T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'downloading',
      detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    },
  }, {
    artistName: 'Boards of Canada',
    expectedTrackCount: 10,
    id: 'wanted-quality-stop',
    matchedTrackCount: 10,
    missingTrackCount: 0,
    quality: {
      code: 'needs_verification',
      profile: { code: 'lossless_archive' },
      tone: 'warning',
    },
    releaseDate: '2002-02-18T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Geogaddi',
    status: {
      code: 'quality_choice_needed',
      detail: 'Downloaded audio needs verification before Harmoniarr adds it to your library.',
      label: 'Quality choice needed',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  }];

  return {
    checkedAt: '2026-07-26T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: releases.length },
    releases,
    summary: { counts: { downloading: 1, quality_choice_needed: 1 }, total: releases.length },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue release row hierarchy browser verification', () => {
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

  test('keeps active queue context compact while preserving clear release rows at desktop and mobile widths', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_release_row_hierarchy',
      });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            dependencies: [{ provider: 'slskd', status: 'healthy' }],
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
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Queued music' }).waitFor();
      await page.getByRole('heading', { exact: true, name: '1 release needs attention' }).waitFor();
      assert.equal(await page.locator('.music-queue-summary-card').count(), 0);
      const secondaryFilters = page.locator('#music-queue-secondary-filters');
      assert.equal(await secondaryFilters.isHidden(), true);
      await page.getByRole('button', { exact: true, name: 'Filters' }).click();
      assert.equal(await secondaryFilters.isVisible(), true);
      await secondaryFilters.getByLabel('State').selectOption('needs_help');
      await page.getByRole('button', { exact: true, name: 'Filters active' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Clear' }).click();
      assert.equal(await secondaryFilters.isHidden(), true);

      const rows = page.locator('.music-queue-release-row');
      const downloadingRow = rows.filter({ hasText: 'Child of God' });
      const qualityRow = rows.filter({ hasText: 'Geogaddi' });
      await downloadingRow.getByText('Downloading', { exact: true }).waitFor();
      await downloadingRow.getByText('Quality profile: Lossless archive').waitFor();
      await qualityRow.getByText('Quality choice needed', { exact: true }).waitFor();
      await qualityRow.getByText('Quality: Needs verification').waitFor();
      assert.equal(await rows.locator('.hx-pill').count(), 0);
      assert.equal(await qualityRow.locator('.is-attention').count(), 1);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Release rows prioritize state, outcome, and a single clear quality warning.',
        name: 'desktop-release-rows',
        surface: 'music-queue-release-list',
      });

      await page.evaluate(() => globalThis.document.documentElement.setAttribute('data-theme', 'dark'));
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'The compact queue overview and release rows retain hierarchy in dark mode.',
        name: 'dark-release-rows',
        surface: 'music-queue-release-list',
      });
      await page.evaluate(() => globalThis.document.documentElement.removeAttribute('data-theme'));

      await page.setViewportSize({ height: 844, width: 390 });
      await qualityRow.getByRole('button', { name: 'Review quality choice' }).waitFor();
      await stabilizeVisualEvidencePage(page);
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The mobile release row should not create horizontal overflow.',
      );
      assert.equal(
        await downloadingRow.evaluate((row) => row.getBoundingClientRect().top < globalThis.innerHeight),
        true,
        'The first queued release should remain visible in the initial mobile viewport.',
      );
      await evidence.capture(page, {
        description: 'Release-row context and actions remain readable without horizontal scrolling on mobile.',
        name: 'mobile-release-rows',
        surface: 'music-queue-release-list',
      });

      await qualityRow.getByRole('button', { name: 'Review quality choice' }).click();
      await page.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 3);
    }, { scenarioName: 'music_queue_release_row_hierarchy' });
  });
});
