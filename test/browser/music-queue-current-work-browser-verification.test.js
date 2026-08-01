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
import {
  createBrowserVisualEvidenceRecorder,
  stabilizeVisualEvidencePage,
} from '../../testing/browser/visual-evidence.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildMusicQueuePayload() {
  const releases = [{
    artistName: 'Boards of Canada',
    expectedTrackCount: 10,
    id: 'wanted-library',
    missingTrackCount: 0,
    releaseGroupType: 'Album',
    releaseTitle: 'Geogaddi',
    status: {
      code: 'in_library',
      detail: 'This release is already in your library.',
      label: 'In library',
      tone: 'success',
    },
  }, {
    artistName: 'Lauren Daigle',
    expectedTrackCount: 12,
    id: 'wanted-waiting',
    missingTrackCount: 12,
    releaseGroupType: 'Album',
    releaseTitle: 'Look Up Child',
    status: {
      code: 'queued_for_search',
      detail: 'Harmoniarr will search when this release is due.',
      label: 'Waiting to search',
      tone: 'neutral',
    },
  }, {
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: 'wanted-downloading',
    missingTrackCount: 8,
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'downloading',
      detail: 'Harmoniarr is downloading a selected match.',
      label: 'Downloading',
      tone: 'info',
    },
  }, {
    artistName: 'Kacey Musgraves',
    expectedTrackCount: 12,
    id: 'wanted-quality',
    missingTrackCount: 12,
    releaseGroupType: 'Album',
    releaseTitle: 'Golden Hour',
    status: {
      code: 'quality_choice_needed',
      detail: 'Harmoniarr needs a quality choice before it can continue.',
      label: 'Quality choice needed',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  }];

  return {
    checkedAt: '2026-07-28T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: releases.length },
    releases,
    summary: {
      counts: { downloading: 1, in_library: 1, quality_choice_needed: 1, queued_for_search: 1 },
      total: releases.length,
    },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue current-work browser verification', () => {
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

  test('defaults to current work and reveals stable releases only on request', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_current_work',
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

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Current work' }).waitFor();
      await page.getByText('Child of God', { exact: true }).waitFor();
      await page.getByText('Golden Hour', { exact: true }).waitFor();
      assert.equal(await page.getByText('Geogaddi', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Look Up Child', { exact: true }).count(), 0);
      await page.getByText('1 release needs attention', { exact: true }).waitFor();
      await page.getByText('Harmoniarr is also working on 1 release.', { exact: true }).waitFor();
      await page.getByText('1 release is scheduled for automatic search.', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Show').inputValue(), 'current');
        assert.equal(
        await page.getByLabel('Music Queue filters').getByRole('link', { name: 'Activity' }).getAttribute('href'),
        '/app/activity/feed',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Current work keeps the decision, active progress, and a compact scheduled-search handoff in one scan path.',
        name: 'desktop-current-work',
        surface: 'music-queue',
      });

      await page.getByRole('button', { name: 'View scheduled releases' }).click();
      assert.equal(await page.getByLabel('Show').inputValue(), 'all');
      assert.equal(await page.getByLabel('State').inputValue(), 'waiting');
      await page.getByText('Look Up Child', { exact: true }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Clear' }).click();

      await page.getByLabel('Show').selectOption('all');
      await page.getByRole('heading', { exact: true, name: 'All releases' }).waitFor();
      await page.getByText('Geogaddi', { exact: true }).waitFor();
      await page.getByText('Look Up Child', { exact: true }).waitFor();
      await page.getByLabel('Show').selectOption('current');
      await page.setViewportSize({ height: 844, width: 390 });
      await page.getByText('Child of God', { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The compact current-work hierarchy should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Current work preserves its priority and compact scheduled-search handoff on mobile.',
        name: 'mobile-current-work',
        surface: 'music-queue',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
    }, { scenarioName: 'music_queue_current_work' });
  });
});
