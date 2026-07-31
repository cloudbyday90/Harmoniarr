/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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
const SHARED_ARTIST = 'Shared Recovery Browser Artist';
const SHARED_RELEASE = 'Shared Recovery Browser Release';
const ADMIN_POLICY_MARKER = 'private-admin-recovery-policy-marker';
const OPERATOR_POLICY_MARKER = 'private-operator-recovery-policy-marker';

const TRYING_NEXT_MATCH_STATUS = Object.freeze({
  code: 'trying_next_match',
  detail: 'A previous match did not work. Harmoniarr is moving to the next eligible match automatically.',
  label: 'Trying another match',
  nextAction: 'view_recovery',
  tone: 'info',
});

const DOWNLOADING_STATUS = Object.freeze({
  code: 'downloading',
  detail: 'Harmoniarr selected the next eligible lossless match and is downloading it now.',
  label: 'Downloading',
  nextAction: 'open_downloader',
  tone: 'info',
});

function buildSharedRecoveryRelease({ policyMarker, status, wantedReleaseId }) {
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
    status: { ...status },
  };
}

function buildSharedRecoveryActivity({ policyMarker, wantedReleaseId }) {
  return [
    {
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
      id: `shared-recovery-download-started-${wantedReleaseId}`,
      occurredAt: '2026-07-30T20:01:00.000Z',
    },
    {
      entityArtist: SHARED_ARTIST,
      entityId: wantedReleaseId,
      entityTitle: SHARED_RELEASE,
      entityType: 'wanted_release',
      eventType: 'music_queue_match_retrying',
      extraPayload: {
        policyMarker,
        recoveryCode: 'candidate_promoted',
        wantedReleaseId,
      },
      id: `shared-recovery-retrying-${wantedReleaseId}`,
      occurredAt: '2026-07-30T20:00:00.000Z',
    },
  ];
}

function getReleaseDetailPath(wantedReleaseId) {
  return `/app/music-queue/${encodeURIComponent(wantedReleaseId)}`;
}

function getReleaseRow(page) {
  return page.getByRole('listitem').filter({ hasText: SHARED_RELEASE });
}

function getActivityEntry(page, eventText) {
  return page.locator('.activity-timeline-entry').filter({ hasText: eventText });
}

function assertNoPrivateSharedData(text, { ownPolicyMarker, otherPolicyMarker, otherWantedReleaseId }) {
  assert.doesNotMatch(text, new RegExp(`${ownPolicyMarker}|${otherPolicyMarker}|${otherWantedReleaseId}`, 'u'));
  assert.doesNotMatch(text, /\bcandidate(?:s)?\b/i);
  assert.doesNotMatch(text, /\/downloads\/|[A-Z]:\\/i);
}

async function assertOwnSharedRecoveryJourney({
  baseUrl,
  otherPolicyMarker,
  otherWantedReleaseId,
  ownPolicyMarker,
  page,
  release,
  readModel,
}) {
  await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
  const releaseRow = getReleaseRow(page);
  const detail = page.getByRole('complementary', { name: 'Music Queue details' });

  await releaseRow.getByText('Trying another match', { exact: true }).waitFor();
  await releaseRow.getByRole('button', { name: 'View recovery' }).click();
  await detail.getByRole('heading', { name: `${SHARED_RELEASE} by ${SHARED_ARTIST}` }).waitFor();
  await detail.getByText('No action is needed. Harmoniarr will continue this release automatically.').waitFor();
  assert.equal(await detail.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
  assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
    otherPolicyMarker,
    otherWantedReleaseId,
    ownPolicyMarker,
  });

  await releaseRow.getByText('Downloading', { exact: true }).waitFor({ timeout: 15_000 });
  await releaseRow.getByRole('link', { name: 'Open Downloader' }).waitFor();
  assert.ok(readModel.getReleaseReadCount() >= 2, 'shared recovery must revalidate without a manual refresh');

  await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
  const retryActivity = getActivityEntry(page, `Trying the next best match: ${SHARED_RELEASE} by ${SHARED_ARTIST}`);
  await retryActivity.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
  const retryHandoff = retryActivity.getByRole('link', { name: 'Open Music Queue' });
  await retryHandoff.waitFor();
  assert.equal(await retryHandoff.getAttribute('href'), getReleaseDetailPath(release.id));

  const downloadActivity = getActivityEntry(page, `Download started: ${SHARED_RELEASE} by ${SHARED_ARTIST}`);
  await downloadActivity.getByText('10 files accepted for download.').waitFor();
  const downloadHandoff = downloadActivity.getByRole('link', { name: 'Open Music Queue' });
  await downloadHandoff.waitFor();
  assert.equal(await downloadHandoff.getAttribute('href'), getReleaseDetailPath(release.id));
  assert.equal(await retryActivity.getByRole('link', { name: /diagnostic/i }).count(), 0);
  assert.equal(await downloadActivity.getByRole('link', { name: /diagnostic/i }).count(), 0);
  assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
    otherPolicyMarker,
    otherWantedReleaseId,
    ownPolicyMarker,
  });
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

suite('Music Queue shared recovery browser acceptance', () => {
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

  test('keeps one shared provider fallback and separate normal Activity stories across isolated sessions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browser, browserContext, page }) => {
      const adminReleaseId = 'wanted-shared-recovery-browser-admin';
      const operatorReleaseId = 'wanted-shared-recovery-browser-operator';
      const adminInitialRelease = buildSharedRecoveryRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        status: TRYING_NEXT_MATCH_STATUS,
        wantedReleaseId: adminReleaseId,
      });
      const adminDownloadingRelease = buildSharedRecoveryRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        status: DOWNLOADING_STATUS,
        wantedReleaseId: adminReleaseId,
      });
      const operatorInitialRelease = buildSharedRecoveryRelease({
        policyMarker: OPERATOR_POLICY_MARKER,
        status: TRYING_NEXT_MATCH_STATUS,
        wantedReleaseId: operatorReleaseId,
      });
      const operatorDownloadingRelease = buildSharedRecoveryRelease({
        policyMarker: OPERATOR_POLICY_MARKER,
        status: DOWNLOADING_STATUS,
        wantedReleaseId: operatorReleaseId,
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
          username: 'shared-recovery-operator',
        });
        const adminReadModel = await installScopedMusicQueueReadModelFixtures(browserContext, {
          activityEvents: buildSharedRecoveryActivity({
            policyMarker: ADMIN_POLICY_MARKER,
            wantedReleaseId: adminReleaseId,
          }),
          releaseSequence: [adminInitialRelease, adminDownloadingRelease],
        });

        operatorContext = await browser.newContext({ serviceWorkers: 'block' });
        const operatorPage = await operatorContext.newPage();
        operatorPage.setDefaultTimeout(integrationRuntimeConfig.httpRequestTimeoutMs);
        operatorPage.on('pageerror', (error) => operatorPageErrors.push(error.message));
        await loginUserThroughUi(operatorPage, {
          baseUrl,
          initialPassword: 'InitialPass123!',
          readyPassword: 'ReadyPass123!',
          username: 'shared-recovery-operator',
        });
        const operatorReadModel = await installScopedMusicQueueReadModelFixtures(operatorContext, {
          activityEvents: buildSharedRecoveryActivity({
            policyMarker: OPERATOR_POLICY_MARKER,
            wantedReleaseId: operatorReleaseId,
          }),
          releaseSequence: [operatorInitialRelease, operatorDownloadingRelease],
        });

        await assertOwnSharedRecoveryJourney({
          baseUrl,
          otherPolicyMarker: OPERATOR_POLICY_MARKER,
          otherWantedReleaseId: operatorReleaseId,
          ownPolicyMarker: ADMIN_POLICY_MARKER,
          page,
          readModel: adminReadModel,
          release: adminDownloadingRelease,
        });
        await assertOwnSharedRecoveryJourney({
          baseUrl,
          otherPolicyMarker: ADMIN_POLICY_MARKER,
          otherWantedReleaseId: adminReleaseId,
          ownPolicyMarker: OPERATOR_POLICY_MARKER,
          page: operatorPage,
          readModel: operatorReadModel,
          release: operatorDownloadingRelease,
        });

        await assertCopiedReleaseIsUnavailable({
          baseUrl,
          page,
          privateMarkers: [ADMIN_POLICY_MARKER, OPERATOR_POLICY_MARKER, operatorReleaseId],
          wantedReleaseId: operatorReleaseId,
        });
        await assertCopiedReleaseIsUnavailable({
          baseUrl,
          page: operatorPage,
          privateMarkers: [ADMIN_POLICY_MARKER, OPERATOR_POLICY_MARKER, adminReleaseId],
          wantedReleaseId: adminReleaseId,
        });

        assert.deepEqual(adminPageErrors, [], `Unexpected admin page errors: ${adminPageErrors.join(' | ')}`);
        assert.deepEqual(operatorPageErrors, [], `Unexpected operator page errors: ${operatorPageErrors.join(' | ')}`);
      } finally {
        await operatorContext?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
        await operatorContext?.close().catch(() => {});
      }
    }, { scenarioName: 'music_queue_shared_recovery_two_session_access' });
  });
});
