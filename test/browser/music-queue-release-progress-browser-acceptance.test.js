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
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const wantedReleaseId = 'wanted-forest-frank-release-progress';

const RELEASE_STAGES = Object.freeze([
  Object.freeze({
    code: 'searching',
    detail: 'Harmoniarr is looking for an acceptable lossless match.',
    label: 'Searching',
    nextAction: 'review_matches',
    tone: 'info',
  }),
  Object.freeze({
    code: 'downloading',
    detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
    label: 'Downloading',
    nextAction: 'open_downloader',
    tone: 'info',
  }),
  Object.freeze({
    code: 'ready_to_add',
    detail: 'Downloaded files passed the audio check and will be added automatically.',
    label: 'Ready to add',
    nextAction: 'add_to_library',
    tone: 'success',
  }),
  Object.freeze({
    code: 'adding_to_library',
    detail: 'Harmoniarr is adding verified files to your library.',
    label: 'Adding to library',
    nextAction: 'view_details',
    tone: 'info',
  }),
  Object.freeze({
    code: 'in_library',
    detail: 'Verified files are available in your library.',
    label: 'In library',
    nextAction: 'open_in_library',
    tone: 'success',
  }),
]);

function buildMusicQueuePayload(stage) {
  const inLibrary = stage.code === 'in_library';

  return {
    checkedAt: '2026-07-26T20:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: wantedReleaseId,
      matchedTrackCount: inLibrary ? 12 : 0,
      missingTrackCount: inLibrary ? 0 : 12,
      quality: {
        code: 'accepted',
        profile: { code: 'lossless_archive' },
        tone: 'success',
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status: stage,
    }],
    summary: { counts: { [stage.code]: 1 }, total: 1 },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue release progress browser acceptance', () => {
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

  test('shows one release progressing from search through library add without candidate-first navigation', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let stageIndex = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        const stage = RELEASE_STAGES[Math.min(stageIndex, RELEASE_STAGES.length - 1)];
        stageIndex += 1;
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload(stage)),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.getByRole('listitem').filter({ hasText: 'Child of God' });
      const details = page.getByRole('complementary', { name: 'Music Queue details' });

      await releaseRow.getByText('Searching', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr is looking for an acceptable lossless match.').waitFor();
      await releaseRow.getByRole('button', { name: 'Review matches' }).click();
      await details.getByRole('heading', { name: 'Child of God by Forest Frank' }).waitFor();

      const evidenceToggle = details.locator('button[aria-controls="music-queue-review-evidence"]');
      assert.equal(await evidenceToggle.count(), 1, await details.innerText());
      assert.equal(await evidenceToggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await details.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
      assert.doesNotMatch(await page.locator('.music-queue-view').innerText(), /\bcandidate(?:s)?\b/i);

      await evidenceToggle.click();
      assert.equal(await evidenceToggle.getAttribute('aria-expanded'), 'true');
      await details.getByRole('link', { name: 'Advanced diagnostics' }).waitFor();

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Downloading', { exact: true }).waitFor();
      await releaseRow.getByRole('link', { name: 'Open Downloader' }).waitFor();
      assert.equal(await releaseRow.getByRole('button', { name: 'Review matches' }).count(), 0);

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Ready to add', { exact: true }).waitFor();
      await releaseRow.getByText('Downloaded files passed the audio check and will be added automatically.').waitFor();
      await releaseRow.getByRole('button', { name: 'View details' }).waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Review add plan' }).count(), 0);

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Adding to library', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr is adding verified files to your library.').waitFor();

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('In library', { exact: true }).waitFor();
      await releaseRow.getByText('All 12 tracks matched').waitFor();
      await releaseRow.getByRole('link', { name: 'Open Library' }).waitFor();

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_release_progress' });
  });
});
