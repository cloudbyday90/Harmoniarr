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
import { installScopedMusicQueueReadModelFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const wantedReleaseId = 'wanted-forest-frank-manual-add';

function buildRelease({ state = 'ready' } = {}) {
  const status = state === 'adding'
    ? {
      code: 'adding_to_library',
      label: 'Adding to library',
      message: 'Harmoniarr is moving verified files into the music library.',
      nextAction: 'view_details',
      tone: 'info',
    }
    : {
      code: 'ready_to_add',
      label: 'Ready to add',
      message: 'Files are ready to be added to the library.',
      nextAction: 'add_to_library',
      tone: 'success',
    };

  return {
    artistName: 'Forest Frank',
    evidence: {
      match: {
        matches: [{
          matchId: 'candidate-forest-frank-manual-add',
          status: state === 'adding' ? 'import_pending' : 'import_pending',
        }],
        statusCounts: { import_pending: 1 },
        totalCount: 1,
      },
    },
    expectedTrackCount: 12,
    id: wantedReleaseId,
    matchedTrackCount: 0,
    missingTrackCount: 12,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status,
  };
}

function buildUnsafeRelease() {
  return {
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: wantedReleaseId,
    missingTrackCount: 12,
    quality: {
      code: 'needs_verification',
      profile: { code: 'lossless_archive' },
      tone: 'warning',
    },
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'needs_help_adding',
      detail: 'The completed files need review before they can be added safely.',
      label: 'Needs help',
      nextAction: 'review_add_plan',
      repair: {
        actionLabel: 'Review audio quality',
        code: 'lossy_audio',
        detail: 'The completed files do not meet the selected quality profile.',
        nextStep: 'Review the audio-quality result before choosing another match.',
        title: 'Audio quality needs review',
      },
      tone: 'warning',
    },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue manual safe add confirmation browser verification', () => {
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

  test('requires confirmation before queuing one fresh safe library add', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixtures = await installScopedMusicQueueReadModelFixtures(browserContext, {
        addToLibraryResponse: {
          action: { code: 'add_to_library', outcome: 'queued', wantedReleaseId },
          release: buildRelease({ state: 'adding' }),
        },
        release: buildRelease(),
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'View details' }).click();

      const review = page.locator('.music-queue-review');
      await review.getByRole('heading', { name: 'Add to library' }).waitFor();
      await review.getByText('Harmoniarr will check the completed files again and start only if they still pass the library, quality, and audio checks.').waitFor();
      await review.getByRole('button', { name: 'Add to library' }).click();

      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('heading', { name: 'Add Child of God to your library?' }).waitFor();
      assert.equal(fixtures.getAddToLibraryRequestCount(), 0);
      await dialog.getByLabel('I understand Harmoniarr will add these verified files to my music library.').check();
      await dialog.getByRole('button', { name: 'Add to library' }).click();

      await review.getByText('Harmoniarr verified the completed files and queued this release to be added to your library.').waitFor();
      assert.equal(fixtures.getAddToLibraryRequestCount(), 1);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_manual_safe_add_confirmation' });
  });

  test('does not expose Add to library for a stopped quality review', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installScopedMusicQueueReadModelFixtures(browserContext, {
        release: buildUnsafeRelease(),
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'Review audio quality' }).click();

      const review = page.locator('.music-queue-review');
      await review.getByRole('heading', { name: 'Audio quality needs review' }).waitFor();
      assert.equal(await review.getByRole('button', { name: 'Add to library' }).count(), 0);
    }, { scenarioName: 'music_queue_manual_safe_add_hidden_for_quality_stop' });
  });
});
