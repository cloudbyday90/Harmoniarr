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
      code: 'adding_to_library',
      detail: 'Harmoniarr is adding verified files to your library.',
      label: 'Adding to library',
      nextAction: 'view_details',
      tone: 'info',
    },
    library: {
      code: 'in_library',
      detail: 'Verified files are available in your library.',
      label: 'In library',
      nextAction: 'open_in_library',
      tone: 'success',
    },
    ready: {
      code: 'ready_to_add',
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
    status,
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
        code: 'needs_help_adding',
        detail: 'Harmoniarr could not verify this claimed FLAC as lossless, so it was not added to your library.',
        label: 'Needs help adding',
        nextAction: 'review_add_plan',
        repair: {
          code: 'media_verification',
          nextStep: 'Check the audio result before choosing another file for this release.',
          title: 'Audio check needs review',
        },
        tone: 'warning',
      },
    }],
    summary: { counts: { quality_choice_needed: 1 }, total: 1 },
  };
}

function buildReleaseAddDiagnosticsPayload() {
  const latestOutcome = {
    diagnosticCandidateId: 'candidate-forest-frank-unsafe-media',
    presentation: {
      code: 'media_verification',
      detail: 'Harmoniarr could not verify the downloaded audio safely, so it was not added to your library.',
      label: 'Audio verification needs review',
      nextStep: 'Review the release quality details before changing the quality choice or searching again.',
      settingsRouteLabel: null,
      settingsRouteName: null,
      tone: 'warning',
    },
    updatedAt: '2026-07-26T18:06:00.000Z',
  };

  return {
    latestOutcome,
    outcomes: [latestOutcome],
    release: {
      artistName: 'Forest Frank',
      id: 'wanted-forest-frank-unsafe-media',
      releaseTitle: 'Child of God',
    },
    summary: {
      message: latestOutcome.presentation.detail,
      status: 'warning',
    },
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
        eventType: 'music_queue_import_blocked',
        extraPayload: {
          addBlockerCode: 'media_verification',
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

      await page.getByLabel('Show').selectOption('all');
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

  test('keeps unsafe media out of the library and offers one release-centred add recovery', {
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
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/wanted-forest-frank-unsafe-media$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify({ release: buildQualityStopPayload().releases[0] }),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/import-candidates\/release-add-diagnostics(?:\?.*)?$/, async (route) => {
        const requestUrl = new URL(route.request().url());
        assert.equal(requestUrl.searchParams.get('wantedReleaseId'), 'wanted-forest-frank-unsafe-media');
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            releaseAddDiagnostics: buildReleaseAddDiagnosticsPayload(),
          }),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByText('Needs help adding', { exact: true }).waitFor();
      await releaseRow.getByText('Harmoniarr could not verify this claimed FLAC as lossless, so it was not added to your library.').waitFor();
      await releaseRow.getByRole('button', { name: 'Review what needs fixing' }).click();
      const reviewPanel = page.locator('.music-queue-review');
      await reviewPanel.getByRole('heading', { name: 'Audio check needs review' }).waitFor();
      await reviewPanel.getByText('Check the audio result before choosing another file for this release.').waitFor();
      await reviewPanel.getByRole('link', { name: 'Advanced diagnostics' }).waitFor();
      assert.equal(await reviewPanel.getByRole('button', { name: 'Allow fallback quality' }).count(), 0);
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Library' }).count(), 0);

      await reviewPanel.getByRole('link', { name: 'Advanced diagnostics' }).click();
      await page.getByRole('heading', { name: 'Library-add details' }).waitFor();
      await page.getByText('Recent safe library-add outcomes for Child of God by Forest Frank.').waitFor();
      await page.getByRole('heading', { name: 'Audio verification needs review' }).waitFor();
      await page.getByRole('link', { name: 'Open match diagnostics' }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('wantedReleaseId'), 'wanted-forest-frank-unsafe-media');
      assert.equal(await page.getByText('Source path').count(), 0);
      assert.equal(await page.getByText('private-source-user').count(), 0);

      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildActivityPayload({ unsafe: true })),
          contentType: 'application/json',
        });
      });
      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const activity = page.locator('.activity-timeline-entry').filter({ hasText: 'Child of God' });
      await activity.getByText('Library add needs help: Child of God by Forest Frank').waitFor();
      await activity.getByText('Harmoniarr could not verify the downloaded audio safely, so it was not added to the library.').waitFor();
      await activity.getByRole('link', { name: 'Review what needs fixing' }).waitFor();
      assert.equal(await activity.getByRole('link', { name: 'Open Library' }).count(), 0);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_unsafe_media_quality_stop' });
  });
});
