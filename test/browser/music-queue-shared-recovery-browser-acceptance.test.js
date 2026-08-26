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

const SEARCHING_STATUS = Object.freeze({
  code: 'searching',
  detail: 'Harmoniarr is looking for matching files.',
  label: 'Searching',
  nextAction: 'search_now',
  tone: 'info',
});

const NO_MATCHES_LEFT_STATUS = Object.freeze({
  code: 'no_matches_left',
  detail: 'Harmoniarr has tried every acceptable match and stopped automatic recovery.',
  label: 'No matches left',
  nextAction: 'try_again',
  tone: 'warning',
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

function buildSharedBoundedStopActivity({ policyMarker, wantedReleaseId }) {
  return [{
    entityArtist: SHARED_ARTIST,
    entityId: wantedReleaseId,
    entityTitle: SHARED_RELEASE,
    entityType: 'wanted_release',
    eventType: 'music_queue_no_matches_left',
    extraPayload: {
      policyMarker,
      rediscoveryExhausted: true,
      rediscoveryScheduled: false,
      wantedReleaseId,
    },
    id: `shared-bounded-stop-${wantedReleaseId}`,
    occurredAt: '2026-07-30T20:02:00.000Z',
  }];
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
  assert.equal(await detail.getByRole('button', { name: 'Search again' }).count(), 0);
  assert.equal(await detail.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
  assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
    otherPolicyMarker,
    otherWantedReleaseId,
    ownPolicyMarker,
  });

  await releaseRow.getByText('Downloading', { exact: true }).waitFor({ timeout: 15_000 });
  await releaseRow.getByRole('link', { name: /View download progress/ }).waitFor();
  assert.ok(readModel.getReleaseReadCount() >= 2, 'shared recovery must revalidate without a manual refresh');

  await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
  const retryActivity = getActivityEntry(page, `Trying the next best match: ${SHARED_RELEASE} by ${SHARED_ARTIST}`);
  await retryActivity.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
  assert.equal(await retryActivity.getByRole('link').count(), 0);

  const downloadActivity = getActivityEntry(page, `Download started: ${SHARED_RELEASE} by ${SHARED_ARTIST}`);
  await downloadActivity.getByText('10 files accepted for download.').waitFor();
  assert.equal(await downloadActivity.getByRole('link').count(), 0);
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

async function assertOwnSharedBoundedStopJourney({
  baseUrl,
  otherPolicyMarker,
  otherWantedReleaseId,
  ownPolicyMarker,
  page,
  release,
}) {
  await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
  const releaseRow = getReleaseRow(page);
  const detail = page.getByRole('complementary', { name: 'Music Queue details' });

  await releaseRow.getByText('No matches left', { exact: true }).waitFor();
  await releaseRow.getByRole('button', { name: 'Review recovery' }).click();
  await detail.getByRole('heading', { name: `${SHARED_RELEASE} by ${SHARED_ARTIST}` }).waitFor();
  await detail.getByRole('heading', { name: 'No matches left' }).waitFor();
  await detail.getByRole('button', { name: 'Search again' }).waitFor();
  assert.equal(await detail.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
  assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
    otherPolicyMarker,
    otherWantedReleaseId,
    ownPolicyMarker,
  });

  await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
  const boundedStopActivity = getActivityEntry(page, `No good matches left: ${SHARED_RELEASE} by ${SHARED_ARTIST}`);
  await boundedStopActivity.getByText('Harmoniarr stopped automatic recovery. Open Music Queue to search again.').waitFor();
  const handoff = boundedStopActivity.getByRole('link', { name: 'Open Music Queue' });
  await handoff.waitFor();
  assert.equal(await handoff.getAttribute('href'), getReleaseDetailPath(release.id));
  assert.equal(await boundedStopActivity.getByRole('link', { name: /diagnostic/i }).count(), 0);
  assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
    otherPolicyMarker,
    otherWantedReleaseId,
    ownPolicyMarker,
  });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue shared recovery browser acceptance', { concurrency: 1 }, () => {
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

  test('keeps a shared bounded stop release-scoped and offers only Search again in isolated sessions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browser, browserContext, page }) => {
      const adminReleaseId = 'wanted-shared-bounded-stop-browser-admin';
      const operatorReleaseId = 'wanted-shared-bounded-stop-browser-operator';
      const adminRelease = buildSharedRecoveryRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        status: NO_MATCHES_LEFT_STATUS,
        wantedReleaseId: adminReleaseId,
      });
      const operatorRelease = buildSharedRecoveryRelease({
        policyMarker: OPERATOR_POLICY_MARKER,
        status: NO_MATCHES_LEFT_STATUS,
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
          username: 'shared-bounded-stop-operator',
        });
        await installScopedMusicQueueReadModelFixtures(browserContext, {
          activityEvents: buildSharedBoundedStopActivity({
            policyMarker: ADMIN_POLICY_MARKER,
            wantedReleaseId: adminReleaseId,
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
          username: 'shared-bounded-stop-operator',
        });
        await installScopedMusicQueueReadModelFixtures(operatorContext, {
          activityEvents: buildSharedBoundedStopActivity({
            policyMarker: OPERATOR_POLICY_MARKER,
            wantedReleaseId: operatorReleaseId,
          }),
          release: operatorRelease,
        });

        await assertOwnSharedBoundedStopJourney({
          baseUrl,
          otherPolicyMarker: OPERATOR_POLICY_MARKER,
          otherWantedReleaseId: operatorReleaseId,
          ownPolicyMarker: ADMIN_POLICY_MARKER,
          page,
          release: adminRelease,
        });
        await assertOwnSharedBoundedStopJourney({
          baseUrl,
          otherPolicyMarker: ADMIN_POLICY_MARKER,
          otherWantedReleaseId: adminReleaseId,
          ownPolicyMarker: OPERATOR_POLICY_MARKER,
          page: operatorPage,
          release: operatorRelease,
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
    }, { scenarioName: 'music_queue_shared_bounded_stop_two_session_access' });
  });

  test('lets one owner restart a shared bounded stop while both sessions return to automatic progress', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browser, browserContext, page }) => {
      const adminReleaseId = 'wanted-shared-manual-restart-browser-admin';
      const operatorReleaseId = 'wanted-shared-manual-restart-browser-operator';
      const adminStoppedRelease = buildSharedRecoveryRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        status: NO_MATCHES_LEFT_STATUS,
        wantedReleaseId: adminReleaseId,
      });
      const adminSearchingRelease = buildSharedRecoveryRelease({
        policyMarker: ADMIN_POLICY_MARKER,
        status: SEARCHING_STATUS,
        wantedReleaseId: adminReleaseId,
      });
      const operatorSearchingRelease = buildSharedRecoveryRelease({
        policyMarker: OPERATOR_POLICY_MARKER,
        status: SEARCHING_STATUS,
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
          username: 'shared-manual-restart-operator',
        });
        const adminReadModel = await installScopedMusicQueueReadModelFixtures(browserContext, {
          release: adminStoppedRelease,
          releaseAfterSearchAgain: adminSearchingRelease,
          searchAgainResponse: {
            action: {
              code: 'search_again',
              dispatchAlreadyActive: false,
              discoveryRunId: 'run-shared-manual-restart',
              restartAlreadyQueued: false,
              wantedReleaseId: adminReleaseId,
            },
            release: adminSearchingRelease,
          },
        });

        operatorContext = await browser.newContext({ serviceWorkers: 'block' });
        const operatorPage = await operatorContext.newPage();
        operatorPage.setDefaultTimeout(integrationRuntimeConfig.httpRequestTimeoutMs);
        operatorPage.on('pageerror', (error) => operatorPageErrors.push(error.message));
        await loginUserThroughUi(operatorPage, {
          baseUrl,
          initialPassword: 'InitialPass123!',
          readyPassword: 'ReadyPass123!',
          username: 'shared-manual-restart-operator',
        });
        const operatorReadModel = await installScopedMusicQueueReadModelFixtures(operatorContext, {
          release: operatorSearchingRelease,
        });

        await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
        const adminReleaseRow = getReleaseRow(page);
        const adminDetail = page.getByRole('complementary', { name: 'Music Queue details' });
        await adminReleaseRow.getByText('No matches left', { exact: true }).waitFor();
        await adminReleaseRow.getByRole('button', { name: 'Review recovery' }).click();
        await adminDetail.getByRole('button', { name: 'Search again' }).click();
        await adminDetail.getByText('Search queued. Harmoniarr will look for this release again.').waitFor();
        await adminReleaseRow.getByText('Searching', { exact: true }).waitFor();
        await adminDetail.getByText('Searching', { exact: true }).waitFor();
        assert.equal(await adminDetail.getByRole('button', { name: 'Search again' }).count(), 0);
        assert.equal(adminReadModel.getSearchAgainRequestCount(), 1);
        assertNoPrivateSharedData(await page.getByRole('main').innerText(), {
          otherPolicyMarker: OPERATOR_POLICY_MARKER,
          otherWantedReleaseId: operatorReleaseId,
          ownPolicyMarker: ADMIN_POLICY_MARKER,
        });

        await operatorPage.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
        const operatorReleaseRow = getReleaseRow(operatorPage);
        const operatorDetail = operatorPage.getByRole('complementary', { name: 'Music Queue details' });
        await operatorReleaseRow.getByText('Searching', { exact: true }).waitFor();
        await operatorReleaseRow.getByRole('button', { name: 'View details' }).click();
        await operatorDetail.getByRole('heading', { name: `${SHARED_RELEASE} by ${SHARED_ARTIST}` }).waitFor();
        assert.equal(await operatorDetail.getByRole('button', { name: 'Search again' }).count(), 0);
        assert.equal(operatorReadModel.getSearchAgainRequestCount(), 0);
        assertNoPrivateSharedData(await operatorPage.getByRole('main').innerText(), {
          otherPolicyMarker: ADMIN_POLICY_MARKER,
          otherWantedReleaseId: adminReleaseId,
          ownPolicyMarker: OPERATOR_POLICY_MARKER,
        });

        assert.deepEqual(adminPageErrors, [], `Unexpected admin page errors: ${adminPageErrors.join(' | ')}`);
        assert.deepEqual(operatorPageErrors, [], `Unexpected operator page errors: ${operatorPageErrors.join(' | ')}`);
      } finally {
        await operatorContext?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
        await operatorContext?.close().catch(() => {});
      }
    }, { scenarioName: 'music_queue_shared_manual_restart_two_session_access' });
  });
});
