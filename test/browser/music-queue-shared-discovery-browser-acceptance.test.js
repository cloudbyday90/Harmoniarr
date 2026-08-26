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
import { createUserThroughApi, loginUserThroughUi } from '../../testing/browser/user-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const SHARED_ARTIST = 'Shared Browser Artist';
const SHARED_RELEASE = 'Shared Browser Release';
const ADMIN_POLICY_MARKER = 'private-admin-policy-marker';
const OPERATOR_POLICY_MARKER = 'private-operator-policy-marker';

function buildSharedRelease({ policyMarker, wantedReleaseId }) {
  return {
    artistName: SHARED_ARTIST,
    expectedTrackCount: 10,
    id: wantedReleaseId,
    matchedTrackCount: 0,
    missingTrackCount: 10,
    policyMarker,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseGroupType: 'Album',
    releaseTitle: SHARED_RELEASE,
    status: {
      code: 'downloading',
      detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    },
  };
}

function buildSharedActivity({ policyMarker, wantedReleaseId }) {
  return [{
    entityArtist: SHARED_ARTIST,
    entityId: wantedReleaseId,
    entityTitle: SHARED_RELEASE,
    entityType: 'wanted_release',
    eventType: 'music_queue_download_started',
    extraPayload: {
      policyMarker,
      queuedFileCount: 10,
      wantedReleaseId,
    },
    id: `download-started-${wantedReleaseId}`,
    occurredAt: '2026-07-30T20:00:00.000Z',
  }];
}

function getReleaseDetailPath(wantedReleaseId) {
  return `/app/music-queue/${encodeURIComponent(wantedReleaseId)}`;
}

async function assertOwnSharedMusicQueueJourney({
  baseUrl,
  otherPolicyMarker,
  otherWantedReleaseId,
  page,
  policyMarker,
  release,
}) {
  await page.goto(`${baseUrl}${getReleaseDetailPath(release.id)}`, { waitUntil: 'domcontentloaded' });
  const releaseRow = page.getByRole('listitem').filter({ hasText: SHARED_RELEASE });
  const detail = page.getByRole('complementary', { name: 'Music Queue details' });

  await releaseRow.getByText('Downloading', { exact: true }).waitFor();
  await detail.getByRole('heading', { name: `${SHARED_RELEASE} by ${SHARED_ARTIST}` }).waitFor();
  await detail.getByText('Harmoniarr selected a verified lossless match and is downloading it now.').waitFor();
  assert.equal(await releaseRow.getByRole('link', { name: /View download progress/ }).count(), 1);
  assert.doesNotMatch(await page.getByRole('main').innerText(), new RegExp(`${policyMarker}|${otherPolicyMarker}`, 'u'));

  await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
  const activity = page.locator('.activity-timeline-entry').filter({ hasText: SHARED_RELEASE });
  await activity.getByText(`Download started: ${SHARED_RELEASE} by ${SHARED_ARTIST}`).waitFor();
  await activity.getByText('10 files accepted for download.').waitFor();
  assert.equal(await activity.getByRole('link').count(), 0);
  assert.doesNotMatch(await activity.innerText(), new RegExp(`${policyMarker}|${otherPolicyMarker}|${otherWantedReleaseId}`, 'u'));
}

async function assertCopiedReleaseIsUnavailable({ baseUrl, page, privateMarkers, wantedReleaseId }) {
  await page.goto(`${baseUrl}${getReleaseDetailPath(wantedReleaseId)}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Release not available' }).waitFor();
  await page.getByText('This Music Queue release is unavailable. Open your queue to continue.').waitFor();
  assert.equal(await page.getByRole('complementary', { name: 'Music Queue details' }).count(), 0);
  assert.equal(await page.locator('.music-queue-release-row').count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Open Music Queue' }).getAttribute('href'), '/app/music-queue');
  assert.doesNotMatch(await page.getByRole('main').innerText(), new RegExp(privateMarkers.join('|'), 'u'));
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue shared discovery browser acceptance', () => {
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

  test('keeps shared release status and Activity handoffs operator-scoped across isolated sessions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browser, browserContext, page }) => {
      const adminRelease = buildSharedRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        wantedReleaseId: 'wanted-shared-browser-admin',
      });
      const operatorRelease = buildSharedRelease({
        policyMarker: OPERATOR_POLICY_MARKER,
        wantedReleaseId: 'wanted-shared-browser-operator',
      });
      const adminPageErrors = [];
      const operatorPageErrors = [];
      let operatorContext;

      page.on('pageerror', (error) => adminPageErrors.push(error.message));

      try {
        await bootstrapAdminThroughUi(page, { baseUrl });
        await createUserThroughApi(page, {
          password: 'InitialPass123!',
          role: 'operator',
          username: 'shared-queue-operator',
        });
        await installScopedMusicQueueReadModelFixtures(browserContext, {
          activityEvents: buildSharedActivity({
            policyMarker: ADMIN_POLICY_MARKER,
            wantedReleaseId: adminRelease.id,
          }),
          release: adminRelease,
        });

        operatorContext = await browser.newContext({ serviceWorkers: 'block' });
        const operatorPage = await operatorContext.newPage();
        operatorPage.setDefaultTimeout(integrationRuntimeConfig.httpRequestTimeoutMs);
        operatorPage.on('pageerror', (error) => operatorPageErrors.push(error.message));
        await loginUserThroughUi(operatorPage, {
          baseUrl,
          initialPassword: 'InitialPass123!',
          readyPassword: 'ReadyPass123!',
          username: 'shared-queue-operator',
        });
        await installScopedMusicQueueReadModelFixtures(operatorContext, {
          activityEvents: buildSharedActivity({
            policyMarker: OPERATOR_POLICY_MARKER,
            wantedReleaseId: operatorRelease.id,
          }),
          release: operatorRelease,
        });

        await assertOwnSharedMusicQueueJourney({
          baseUrl,
          otherPolicyMarker: OPERATOR_POLICY_MARKER,
          otherWantedReleaseId: operatorRelease.id,
          page,
          policyMarker: ADMIN_POLICY_MARKER,
          release: adminRelease,
        });
        await assertOwnSharedMusicQueueJourney({
          baseUrl,
          otherPolicyMarker: ADMIN_POLICY_MARKER,
          otherWantedReleaseId: adminRelease.id,
          page: operatorPage,
          policyMarker: OPERATOR_POLICY_MARKER,
          release: operatorRelease,
        });

        await assertCopiedReleaseIsUnavailable({
          baseUrl,
          page,
          privateMarkers: [ADMIN_POLICY_MARKER, OPERATOR_POLICY_MARKER, operatorRelease.id],
          wantedReleaseId: operatorRelease.id,
        });
        await assertCopiedReleaseIsUnavailable({
          baseUrl,
          page: operatorPage,
          privateMarkers: [ADMIN_POLICY_MARKER, OPERATOR_POLICY_MARKER, adminRelease.id],
          wantedReleaseId: adminRelease.id,
        });

        assert.deepEqual(adminPageErrors, [], `Unexpected admin page errors: ${adminPageErrors.join(' | ')}`);
        assert.deepEqual(operatorPageErrors, [], `Unexpected operator page errors: ${operatorPageErrors.join(' | ')}`);
      } finally {
        await operatorContext?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
        await operatorContext?.close().catch(() => {});
      }
    }, { scenarioName: 'music_queue_shared_discovery_two_session_access' });
  });
});
