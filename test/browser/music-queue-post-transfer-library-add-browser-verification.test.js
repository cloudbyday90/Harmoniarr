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
const wantedReleaseId = 'wanted-forest-frank-post-transfer';

function buildRelease({ state }) {
  const states = {
    adding: {
      detail: 'Harmoniarr is adding verified files to your library.',
      label: 'Adding to library',
      nextAction: 'view_details',
      tone: 'info',
    },
    library: {
      detail: 'Verified files are available in your library.',
      label: 'In library',
      nextAction: 'open_in_library',
      tone: 'success',
    },
    ready: {
      detail: 'Downloaded files passed the audio check and will be added automatically.',
      label: 'Ready to add',
      nextAction: 'add_to_library',
      tone: 'success',
    },
  };
  const status = states[state];

  return {
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: wantedReleaseId,
    matchedTrackCount: state === 'library' ? 12 : 0,
    missingTrackCount: state === 'library' ? 0 : 12,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: { code: `${state}_state`, ...status },
  };
}

function buildMusicQueuePayload(state) {
  const release = buildRelease({ state });
  return {
    checkedAt: '2026-07-26T18:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [release],
    summary: { counts: { [release.status.code]: 1 }, total: 1 },
  };
}

function buildQualityStopPayload() {
  return {
    checkedAt: '2026-07-26T18:05:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forest-frank-unsafe-media',
      missingTrackCount: 12,
      quality: {
        code: 'needs_verification',
        profile: { code: 'lossless_archive' },
        tone: 'warning',
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status: {
        code: 'quality_choice_needed',
        detail: 'Harmoniarr could not verify this claimed FLAC as lossless, so it was not added to your library.',
        label: 'Quality choice needed',
        nextAction: 'review_quality_choice',
        tone: 'warning',
      },
    }],
    summary: { counts: { quality_choice_needed: 1 }, total: 1 },
  };
}

function buildActivityPayload({ unsafe = false } = {}) {
  if (unsafe) {
    return {
      checkedAt: '2026-07-26T18:06:00.000Z',
      events: [{
        entityArtist: 'Forest Frank',
        entityId: 'wanted-forest-frank-unsafe-media',
        entityTitle: 'Child of God',
        entityType: 'wanted_release',
        eventType: 'music_queue_quality_blocked',
        extraPayload: {
          blockers: [{
            code: 'lossless_not_verified',
            message: 'Harmoniarr could not verify this claimed FLAC as lossless.',
          }],
          wantedReleaseId: 'wanted-forest-frank-unsafe-media',
        },
        id: 'quality-blocked',
        occurredAt: '2026-07-26T18:06:00.000Z',
      }],
      ok: true,
      total: 1,
    };
  }

  return {
    checkedAt: '2026-07-26T18:10:00.000Z',
    events: [{
      entityArtist: 'Forest Frank',
      entityId: 'candidate-forest-frank',
      entityTitle: 'Child of God',
      entityType: 'import_candidate',
      eventType: 'release_added',
      extraPayload: {
        movedCount: 12,
        presentationType: 'release_added',
        primaryRelease: { artistName: 'Forest Frank', releaseTitle: 'Child of God' },
        releaseCount: 1,
        releases: [{ artistName: 'Forest Frank', releaseTitle: 'Child of God' }],
        schemaVersion: 1,
        source: { operationType: 'import_candidate_apply', runId: 'run-post-transfer-1' },
        wantedReleaseId,
      },
      id: 'release-added',
      occurredAt: '2026-07-26T18:09:00.000Z',
    }, {
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'music_queue_audio_checked',
      extraPayload: { wantedReleaseId },
      id: 'audio-checked',
      occurredAt: '2026-07-26T18:08:00.000Z',
    }, {
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'download_completed',
      extraPayload: { wantedReleaseId },
      id: 'download-completed',
      occurredAt: '2026-07-26T18:07:00.000Z',
    }, {
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'music_queue_download_started',
      extraPayload: { wantedReleaseId },
      id: 'download-started',
      occurredAt: '2026-07-26T18:06:00.000Z',
    }],
    ok: true,
    total: 4,
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue post-transfer library add browser verification', () => {
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

  test('shows a completed verified transfer progressing to the library and one compact Activity story', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      const states = ['ready', 'adding', 'library'];
      let readCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        const state = states[Math.min(readCount, states.length - 1)];
        readCount += 1;
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload(state)),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Ready to add', { exact: true }).waitFor();
      await releaseRow.getByText('Downloaded files passed the audio check and will be added automatically.').waitFor();
      await releaseRow.getByRole('button', { name: 'View details' }).waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Review add plan' }).count(), 0);

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Adding to library', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr is adding verified files to your library.').waitFor();

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('In library', { exact: true }).waitFor();
      await releaseRow.getByRole('link', { name: 'Open Library' }).waitFor();

      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildActivityPayload()),
          contentType: 'application/json',
        });
      });
      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const story = page.locator('.activity-timeline-entry').filter({ hasText: 'Child of God' });
      await story.getByRole('heading', { name: 'Child of God by Forest Frank added to library' }).waitFor();
      await story.getByRole('link', { name: 'Open Library' }).waitFor();
      await story.locator('summary').click();
      await story.getByText('Download started: Child of God by Forest Frank').waitFor();
      await story.getByText('Download completed: Child of God by Forest Frank').waitFor();
      await story.getByText('Audio checked: Child of God by Forest Frank').waitFor();
      assert.equal(await page.locator('.activity-timeline > .activity-timeline-item').count(), 1);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_post_transfer_library_add' });
  });

  test('keeps unsafe media out of the library and offers only release-scoped quality repair', {
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
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildQualityStopPayload()),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Quality choice needed', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr could not verify this claimed FLAC as lossless, so it was not added to your library.').waitFor();
      await releaseRow.getByRole('button', { name: 'Review quality choice' }).waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Library' }).count(), 0);

      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildActivityPayload({ unsafe: true })),
          contentType: 'application/json',
        });
      });
      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const activity = page.locator('.activity-timeline-entry').filter({ hasText: 'Child of God' });
      await activity.getByText('Quality choice needed: Child of God by Forest Frank').waitFor();
      await activity.getByText('Harmoniarr could not verify this claimed FLAC as lossless.').waitFor();
      await activity.getByRole('link', { name: 'Review quality choice' }).waitFor();
      assert.equal(await activity.getByRole('link', { name: 'Open Library' }).count(), 0);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_unsafe_media_quality_stop' });
  });
});
