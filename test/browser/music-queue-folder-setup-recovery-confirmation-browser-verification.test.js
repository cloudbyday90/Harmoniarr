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

function buildMusicQueuePayload({ isRecovered }) {
  const status = isRecovered
    ? {
      code: 'searching',
      detail: 'Harmoniarr is looking for an acceptable match.',
      label: 'Searching',
      nextAction: 'review_matches',
      tone: 'info',
    }
    : {
      code: 'needs_setup',
      detail: 'Set up folders before Harmoniarr can start a download.',
      label: 'Needs setup',
      nextAction: 'set_up_folders',
      tone: 'warning',
    };

  return {
    checkedAt: '2026-07-26T15:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forest-frank-folders',
      missingTrackCount: 12,
      releaseGroupTitle: 'Child of God',
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status,
    }],
    summary: { counts: { [status.code]: 1 }, total: 1 },
  };
}

function buildHealthyPathValidation() {
  return {
    downloadMappings: [],
    notes: {},
    roots: [
      { key: 'downloads', label: 'Downloads folder', message: 'Ready to use.', path: '/data/downloads', status: 'healthy' },
      { key: 'music', label: 'Music library', message: 'Ready to use.', path: '/data/music', status: 'healthy' },
      { key: 'staging', label: 'Staging area', message: 'Ready to use.', path: '/data/staging', status: 'healthy' },
    ],
    summary: { message: 'Your folders are ready for automatic downloads.', status: 'healthy' },
    userMusicRoots: [],
  };
}

function buildAudioCheckRecoveryPayload({ isQueued }) {
  const status = isQueued
    ? {
      code: 'adding_to_library',
      detail: 'Harmoniarr is safely adding the checked download to your library.',
      label: 'Adding to library',
      nextAction: 'show_details',
      tone: 'info',
    }
    : {
      code: 'needs_help_adding',
      detail: 'Harmoniarr could not finish checking the downloaded audio, so it was not added to your library.',
      label: 'Needs help',
      nextAction: 'recheck_library_add',
      repair: {
        actionCode: 'recheck_library_add',
        actionLabel: 'Try audio check again',
        code: 'media_verification',
        detail: 'Harmoniarr could not finish checking the downloaded audio, so it was not added to your library.',
        nextStep: 'When media tools are available again, try the audio check. Harmoniarr will safely recheck this same completed download before adding it.',
        reasonCode: 'audio_check_failed',
        title: 'Audio check could not finish',
      },
      tone: 'warning',
    };

  return {
    checkedAt: '2026-08-01T15:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forrest Frank',
      expectedTrackCount: 12,
      id: 'wanted-forrest-frank-audio',
      missingTrackCount: 12,
      releaseGroupTitle: 'Child of God',
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status,
    }],
    summary: { counts: { [status.code]: 1 }, total: 1 },
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue folder setup recovery confirmation browser verification', () => {
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

  test('validated folder setup confirms recovery and returns the release to automatic search', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let recovered = false;
      let savedSettingsPayload = null;
      let settingsPayload = null;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload({ isRecovered: recovered })),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/acquisition/releases/wanted-forest-frank-folders', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            release: buildMusicQueuePayload({ isRecovered: recovered }).releases[0],
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        if (route.request().method() === 'GET') {
          const response = await route.fetch();
          settingsPayload = await response.json();
          await route.fulfill({ body: JSON.stringify(settingsPayload), contentType: 'application/json', response });
          return;
        }

        savedSettingsPayload = route.request().postDataJSON();
        recovered = true;
        await route.fulfill({
          body: JSON.stringify({
            ...structuredClone(settingsPayload),
            musicQueueRecovery: {
              dispatchAlreadyActive: false,
              dispatchDeferred: false,
              releasedCount: 1,
              runStarted: true,
            },
            pathValidation: buildHealthyPathValidation(),
          }),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const stoppedRelease = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await stoppedRelease.getByText('Needs setup', { exact: true }).waitFor();
      assert.equal(
        await stoppedRelease.getByRole('link', { name: 'Set up folders' }).getAttribute('href'),
        '/app/settings/media-storage?returnTo=missing_music_decision&returnReleaseId=wanted-forest-frank-folders',
      );
      await Promise.all([
        page.waitForURL(/\/app\/settings\/media-storage(?:\?.*)?$/),
        stoppedRelease.getByRole('link', { name: 'Set up folders' }).click(),
      ]);
      assert.match(
        page.url(),
        /\/app\/settings\/media-storage\?returnTo=missing_music_decision&returnReleaseId=wanted-forest-frank-folders$/,
      );

      await page.getByRole('heading', { name: 'Media folders' }).waitFor();
      await page.getByRole('heading', { name: 'Folder readiness' }).waitFor();
      await page.getByLabel('Downloads folder').fill('/data/downloads');
      await page.getByLabel('Music library').fill('/data/music');
      await page.getByLabel('Staging area').fill('/data/staging');
      const invalidInputs = await page.locator('form').evaluate((form) => [...form.elements]
        .filter((element) => element instanceof globalThis.HTMLInputElement && !element.validity.valid)
        .map((element) => ({ id: element.id, value: element.value, validationMessage: element.validationMessage })));
      assert.deepEqual(invalidInputs, [], `Settings form has invalid values: ${JSON.stringify(invalidInputs)}`);
      await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/api/v1/settings')
          && response.request().method() !== 'GET'),
        page.getByRole('button', { name: 'Save settings' }).click(),
      ]);

      const confirmation = page.getByRole('status').filter({
        hasText: 'Settings saved. Music Queue is searching for 1 release automatically.',
      });
      await confirmation.getByText('Settings saved. Music Queue is searching for 1 release automatically.').waitFor();
      assert.equal(await confirmation.getAttribute('aria-atomic'), 'true');
      assert.equal(savedSettingsPayload.paths.downloads, '/data/downloads');
      assert.equal(savedSettingsPayload.paths.music, '/data/music');
      assert.equal(savedSettingsPayload.paths.staging, '/data/staging');
      await page.getByText('Your folders are ready for automatic downloads.').waitFor();

      const recoveryConfirmation = page.locator('.settings-recovery-confirmation');
      await recoveryConfirmation.getByRole('heading', { name: 'Folders are ready' }).waitFor();
      await recoveryConfirmation.getByText("Return to Music Queue to see this release's next automatic step.").waitFor();
      assert.equal(
        await recoveryConfirmation.getByRole('link', { name: 'Return to Music Queue' }).getAttribute('href'),
        '/app/music-queue/wanted-forest-frank-folders',
      );

      await Promise.all([
        page.waitForURL(/\/app\/music-queue\/wanted-forest-frank-folders$/),
        recoveryConfirmation.getByRole('link', { name: 'Return to Music Queue' }).click(),
      ]);
      const recoveredRelease = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await recoveredRelease.getByText('Searching', { exact: true }).waitFor();
      await recoveredRelease.getByText('Harmoniarr is looking for an acceptable match.').waitFor();
      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_folder_setup_recovery_confirmation' });
  });

  test('audio recheck resumes only the selected completed download after the media prerequisite returns', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let queued = false;
      let recheckRequestBody = null;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildAudioCheckRecoveryPayload({ isQueued: queued })),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/acquisition/releases/wanted-forrest-frank-audio', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            release: buildAudioCheckRecoveryPayload({ isQueued: queued }).releases[0],
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/acquisition/releases/wanted-forrest-frank-audio/recheck-library-add', async (route) => {
        assert.equal(route.request().method(), 'POST');
        recheckRequestBody = route.request().postDataJSON();
        queued = true;
        await route.fulfill({
          body: JSON.stringify({
            action: {
              code: 'recheck_library_add',
              outcome: 'queued',
              wantedReleaseId: 'wanted-forrest-frank-audio',
            },
            release: buildAudioCheckRecoveryPayload({ isQueued: true }).releases[0],
          }),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue/wanted-forrest-frank-audio`, { waitUntil: 'domcontentloaded' });
      const review = page.locator('.music-queue-review');
      await review.getByRole('heading', { name: 'Child of God by Forrest Frank' }).waitFor();
      await review.getByRole('heading', { name: 'Audio check could not finish' }).waitFor();
      await review.getByText('When media tools are available again, try the audio check. Harmoniarr will safely recheck this same completed download before adding it.').waitFor();
      await review.getByRole('link', { name: 'Advanced diagnostics' }).waitFor();

      await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/recheck-library-add')
          && response.request().method() === 'POST'),
        review.getByRole('button', { name: 'Try audio check again' }).click(),
      ]);

      assert.deepEqual(recheckRequestBody, {});
      await review.getByRole('status').filter({
        hasText: 'Audio check passed. Harmoniarr queued this release for a safe library add.',
      }).waitFor();
      await review.getByText('Adding to library', { exact: true }).waitFor();
      await review.getByText('Harmoniarr is safely adding the checked download to your library.').waitFor();
      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_audio_recheck_safe_add' });
  });
});
