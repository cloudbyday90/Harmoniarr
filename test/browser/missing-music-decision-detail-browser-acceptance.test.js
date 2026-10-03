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
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  buildLinkedDownloaderQueueFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import {
  assertFocusWithin,
  assertLocatorFocused,
  assertTabFocusContained,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildDecision({ accountStatus = 'active', downloadStarted = false, matchSelected = false, qualityChoiceCode = null, searchQueued = false, searchStopped = false } = {}) {
  return {
    decisionId: 'wanted-amber',
    expectedTrackCount: 10,
    lastReconciledAt: '2026-08-26T16:00:00.000Z',
    matchedTrackCount: 0,
    release: {
      artistName: 'Autechre',
      releaseDate: '1994-11-07',
      releaseGroupType: 'Album',
      title: 'Amber',
    },
    requestedFor: {
      accountStatus,
      id: 'listener-1',
      username: 'Jamie',
    },
    status: searchQueued
      ? { code: 'searching', label: 'Search queued', message: 'Harmoniarr will evaluate this release again.', nextAction: null, tone: 'info' }
      : qualityChoiceCode
      ? { code: 'quality_choice_needed', label: 'Quality choice needed', message: 'The best match does not clearly satisfy the selected quality preference.', nextAction: 'review_quality_choice', tone: 'warning' }
      : searchStopped
      ? { code: 'no_matches_left', label: 'Search stopped', message: 'No acceptable matches remain.', nextAction: 'try_again', tone: 'warning' }
      : downloadStarted
      ? {
        label: 'Download preparation started',
        message: 'The selected match is queued for download preparation.',
        nextAction: 'open_downloader',
        tone: 'info',
      }
      : matchSelected
      ? {
        label: 'Match selected',
        message: 'A match has been selected. A download will not start until someone explicitly starts it.',
        nextAction: 'download_now',
        tone: 'warning',
      }
      : {
        label: 'Choose a match',
        message: 'Harmoniarr found options that need a selection.',
        nextAction: 'review_matches',
        tone: 'warning',
      },
  };
}

function buildWorklistPayload() {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decisions: [buildDecision()],
    filters: {
      accountStatus: 'active',
      q: '',
      requestedForUserId: '',
      state: 'action',
    },
    page: {
      limit: 50,
      offset: 0,
      sourceLimitReached: false,
      total: 1,
    },
    scope: 'all',
    users: [
      { accountStatus: 'active', id: 'listener-1', username: 'Jamie' },
    ],
  };
}

async function installMissingMusicFixture(browserContext, requests, {
  accountStatus = 'active',
  downloadStarted = false,
  matchSelected = false,
  minimumBitrateKbps = null,
  qualityChoiceCode = null,
  searchStopped = false,
} = {}) {
  const state = {
    downloadStartRequest: null,
    downloadStarted,
    matchSelected,
    minimumBitrateKbps,
    selectionRequest: null,
    accountStatus,
    detailReadFailure: false,
    searchAgainAvailable: searchStopped || Boolean(qualityChoiceCode),
    searchAgainFailure: false,
    searchAgainRequest: null,
    searchAgainRequestCount: 0,
    searchQueued: false,
    searchStopped,
    qualityChoiceCode,
    qualityFallbackAvailable: qualityChoiceCode === 'below_minimum',
    qualityFallbackAllowed: false,
    qualityFallbackFailure: false,
    qualityFallbackRequest: null,
    qualityFallbackRequestCount: 0,
    qualityResponseWait: null,
  };

  await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl.pathname);
    const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
    const selectionPath = `${detailPath}/matches/candidate-amber/select`;
    const downloadStartPath = `${detailPath}/start-download`;
    const downloaderHandoffPath = `${detailPath}/downloader-handoff`;
    const searchAgainPath = `${detailPath}/search-again`;
    const qualityFallbackPath = `${detailPath}/allow-fallback-quality`;

    if (route.request().method() === 'POST' && requestUrl.pathname === qualityFallbackPath) {
      const headers = route.request().headers();
      state.qualityFallbackRequestCount += 1;
      state.qualityFallbackRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      if (state.qualityResponseWait) await state.qualityResponseWait;
      if (state.qualityFallbackFailure) {
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private provider /mnt/downloads source identity' } }) });
        return;
      }
      state.qualityFallbackAllowed = true;
      state.qualityFallbackAvailable = false;
      state.searchQueued = true;
      state.searchAgainAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'allow_fallback_quality', decisionId: 'wanted-amber', targetUserId: 'listener-1',
          fallbackAllowed: true, searchPreparationStarted: true, overrideAlreadyAllowed: false,
          restartAlreadyQueued: false, dispatchAlreadyActive: false, discoveryRunId: 'run-quality' },
      }) });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === searchAgainPath) {
      const headers = route.request().headers();
      state.searchAgainRequestCount += 1;
      state.searchAgainRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      if (state.searchAgainFailure) {
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private provider /mnt/downloads source identity' } }) });
        return;
      }
      state.searchQueued = true;
      state.searchAgainAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'search_again', decisionId: 'wanted-amber', targetUserId: 'listener-1',
          searchPreparationStarted: true, restartAlreadyQueued: false, dispatchAlreadyActive: false, discoveryRunId: 'run-search' },
      }) });
      return;
    }

    if (route.request().method() === 'GET' && requestUrl.pathname === detailPath && state.detailReadFailure) {
      await route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private database host' } }) });
      return;
    }

    if (route.request().method() === 'GET' && requestUrl.pathname === downloaderHandoffPath) {
      await route.fulfill({
        body: JSON.stringify({
          decisionId: 'wanted-amber',
          ok: true,
          release: { artistName: 'Autechre', title: 'Amber' },
          requestedFor: { username: 'Jamie' },
          wantedReleaseId: 'wanted-amber',
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === selectionPath) {
      const headers = route.request().headers();
      state.selectionRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      state.matchSelected = true;
      await route.fulfill({
        body: JSON.stringify({
          action: {
            code: 'use_match',
            decisionId: 'wanted-amber',
            downloadStarted: false,
            matchId: 'candidate-amber',
            targetUserId: 'listener-1',
          },
          ok: true,
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === downloadStartPath) {
      const headers = route.request().headers();
      state.downloadStartRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      state.downloadStarted = true;
      await route.fulfill({
        body: JSON.stringify({
          action: {
            code: 'start_download',
            decisionId: 'wanted-amber',
            downloadPreparationStarted: true,
            matchId: 'candidate-amber',
            operationRunId: 'run-amber',
            targetUserId: 'listener-1',
          },
          ok: true,
        }),
        contentType: 'application/json',
        status: 202,
      });
      return;
    }

    const payload = requestUrl.pathname === detailPath
      ? {
        checkedAt: '2026-08-26T16:31:00.000Z',
        decision: buildDecision({
          accountStatus: state.accountStatus,
          downloadStarted: state.downloadStarted,
          matchSelected: state.matchSelected,
          qualityChoiceCode: state.qualityChoiceCode,
          searchQueued: state.searchQueued,
          searchStopped: state.searchStopped,
        }),
        matchChoices: state.matchSelected || state.searchStopped || state.qualityChoiceCode
          ? []
          : [{
            fileCount: 10,
            formats: ['FLAC'],
            id: 'candidate-amber',
            totalSizeBytes: 358000000,
          }],
        permissions: {
          canAllowFallbackQuality: state.qualityFallbackAvailable && state.accountStatus !== 'disabled',
          canSelectMatch: !state.matchSelected && !state.searchStopped && !state.qualityChoiceCode,
          canSearchAgain: state.searchAgainAvailable && state.accountStatus !== 'disabled',
          canStartDownload: state.matchSelected && !state.downloadStarted,
          canViewDownloader: state.downloadStarted,
          isReadOnly: state.accountStatus === 'disabled',
        },
        qualityEvidence: state.qualityChoiceCode ? {
          code: state.searchQueued ? 'no_evidence' : state.qualityChoiceCode,
          profileCode: 'lossless_archive',
          formats: state.qualityChoiceCode === 'needs_verification' ? ['flac'] : ['mp3'],
          bitrateKbps: state.qualityChoiceCode === 'needs_verification' ? null : 128,
          preferredFormats: ['flac'],
          minimumFormats: state.qualityFallbackAllowed ? ['flac', 'alac', 'wav', 'mp3', 'aac', 'opus', 'ogg'] : ['flac', 'alac', 'wav'],
          minimumBitrateKbps: state.minimumBitrateKbps ?? (state.qualityFallbackAllowed ? 256 : null),
          requiresVerification: true,
          verifiedLossless: false,
          fallbackAllowed: state.qualityFallbackAllowed,
          fallbackOverrideActive: state.qualityFallbackAllowed,
        } : null,
        scope: 'all',
      }
      : { ...buildWorklistPayload(), decisions: [buildDecision(state)] };

    await route.fulfill({
      body: JSON.stringify({ ok: true, ...payload }),
      contentType: 'application/json',
      status: 200,
    });
  });

  return state;
}

function buildAmberDownloaderQueue() {
  const defaultQueue = buildLinkedDownloaderQueueFixture();
  const amberTransfer = {
    ...defaultQueue.transfers[0],
    diagnostics: {
      ...defaultQueue.transfers[0].diagnostics,
      importLinkage: {
        ...defaultQueue.transfers[0].diagnostics.importLinkage,
        musicQueueRelease: {
          ...defaultQueue.transfers[0].diagnostics.importLinkage.musicQueueRelease,
          wantedReleaseId: 'wanted-amber',
        },
      },
    },
  };

  return buildLinkedDownloaderQueueFixture({ transfers: [amberTransfer] });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music decision detail browser acceptance', () => {
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

  test('opens a server-authorized release-status detail with a clear return path', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await installMissingMusicFixture(browserContext, requests);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      const detailLink = page.getByRole('link', { name: 'Open status details for Autechre — Amber' });
      await detailLink.focus();
      await assertLocatorFocused(detailLink, 'the release-details link should receive keyboard focus');
      await assertVisibleFocusOutline(detailLink, 'the release-details link focus indicator should be visible');
      await detailLink.click();

      const heading = page.getByRole('heading', { exact: true, level: 2, name: 'Amber' });
      await heading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing/wanted-amber');
      await assertLocatorFocused(heading, 'opening release details should focus the inspector title');
      await assertVisibleFocusOutline(heading, 'the inspector title focus indicator should be visible');
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' }).waitFor();
      await inspector.getByText('Jamie', { exact: true }).waitFor();
      await inspector.getByText('Next step:', { exact: false }).waitFor();
      assert.ok(requests.includes('/api/v1/missing-music/decisions/wanted-amber'));

      await page.getByRole('link', { name: 'Back to release decisions' }).click();
      const pageHeading = page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' });
      await pageHeading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing');
      await assertLocatorFocused(pageHeading, 'returning to release decisions should focus the Missing Music page title');
      await assertVisibleFocusOutline(pageHeading, 'the Missing Music page title focus indicator should be visible');
    }, {
      scenarioName: 'missing_music_decision_detail_navigation',
    });
  });

  test('queues Search again, refreshes both decision surfaces, and retains the snapshot on safe refresh failure', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { searchStopped: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const searchButton = inspector.getByRole('button', { exact: true, name: 'Search again' });
      await searchButton.focus();
      await assertVisibleFocusOutline(searchButton, 'Search again should expose its keyboard focus');
      await searchButton.press('Enter');
      await inspector.getByText('Search queued', { exact: true }).waitFor();
      await inspector.getByText('A new search is queued. Acquisition will follow the saved automation policy.', { exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { exact: true, name: 'Current status' }), 'the completed command should focus the updated state');
      assert.equal(fixture.searchAgainRequestCount, 1);
      assert.deepEqual(fixture.searchAgainRequest.body, {});
      assert.match(fixture.searchAgainRequest.csrfToken, /.+/u);
      assert.match(fixture.searchAgainRequest.idempotencyKey, /.+/u);
      assert.equal(fixture.downloadStartRequest, null);
      assert.equal(fixture.selectionRequest, null);

      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      const pageRefresh = page.locator('.hx-page-header').getByRole('button', { exact: true, name: 'Refresh' });
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        pageRefresh.click(),
      ]);
      await pageRefresh.waitFor();
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      await assertLocatorFocused(pageRefresh, 'Refresh should retain its invoker focus');

      const filterInput = page.getByLabel('Search releases', { exact: true });
      await filterInput.focus();
      fixture.detailReadFailure = true;
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath && response.status() === 503),
        page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
      ]);
      await inspector.getByRole('alert').getByText('Missing Music release details could not be refreshed. Try again.', { exact: true }).waitFor();
      await inspector.getByText('Search queued', { exact: true }).waitFor();
      await assertLocatorFocused(filterInput, 'a failed background refresh should retain keyboard focus');
      assert.doesNotMatch(await inspector.innerText(), /Private database|Private provider|\/mnt/u);
      assert.deepEqual(pageErrors, []);
    }, { scenarioName: 'missing_music_search_again_and_freshness' });
  });

  test('Search again failures use public feedback and unsupported or disabled decisions expose no retry button', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { searchStopped: true });
      fixture.searchAgainFailure = true;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('button', { exact: true, name: 'Search again' }).click();
      await inspector.getByRole('alert').getByText('The search could not be queued. Refresh this release and try again.', { exact: true }).waitFor();
      assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt/u);
      const previousKey = fixture.searchAgainRequest.idempotencyKey;
      await inspector.getByRole('button', { exact: true, name: 'Search again' }).click();
      assert.equal(fixture.searchAgainRequest.idempotencyKey, previousKey);
      assert.equal(fixture.searchAgainRequestCount, 2);

      fixture.searchAgainAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('Search stopped', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { exact: true, name: 'Search again' }).count(), 0);
      fixture.searchAgainAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { exact: true, name: 'Search again' }).count(), 0);
      assert.equal(fixture.searchAgainRequestCount, 2);
    }, { scenarioName: 'missing_music_search_again_safe_failures' });
  });

  test('saves recipient quality consent by keyboard, refreshes both surfaces, and renders in light and dark layouts', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { qualityChoiceCode: 'below_minimum', minimumBitrateKbps: 320 });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const quality = inspector.getByRole('region', { name: 'Quality', exact: true });
      await quality.getByText('128 kbps', { exact: true }).waitFor();
      await quality.getByText('Not verified', { exact: true }).waitFor();
      await quality.getByText('Lossless archive', { exact: true }).waitFor();
      await quality.getByText('Allow MP3, AAC, Opus, or Ogg at 320 kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.', { exact: true }).waitFor();
      await quality.getByText('This choice applies to this release for Jamie. Other household recipients’ quality requirements still apply.', { exact: true }).waitFor();
      const allow = quality.getByRole('button', { exact: true, name: 'Allow fallback quality' });
      const search = inspector.getByRole('button', { exact: true, name: 'Search again' });
      assert.equal(await search.isVisible(), true);
      assert.match(await inspector.innerText(), /This keeps the current quality choice/u);
      assert.doesNotMatch(await quality.innerText(), /upgrade/iu);

      const screenshotDirectory = resolve('.tmp/missing-music-quality-fallback');
      await mkdir(screenshotDirectory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await allow.focus();
          await assertVisibleFocusOutline(allow, 'the fallback action should expose keyboard focus in every theme');
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await quality.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          if (width > 640) {
            const firstRowTops = await quality.locator('.hx-missing-quality__facts > div').evaluateAll((elements, count) =>
              elements.slice(0, count).map((element) => element.getBoundingClientRect().top), width > 960 ? 3 : 2);
            assert.ok(Math.max(...firstRowTops) - Math.min(...firstRowTops) <= 1, 'quality facts in the same grid row should align');
          }
          if (width === 390) assert.ok((await allow.boundingBox()).height >= 44);
          await quality.screenshot({ path: resolve(screenshotDirectory, `quality-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      let finishQualityResponse;
      fixture.qualityResponseWait = new Promise((resolveResponse) => { finishQualityResponse = resolveResponse; });
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      await allow.focus();
      await allow.press('Enter');
      await quality.getByRole('button', { exact: true, name: 'Saving…' }).waitFor();
      assert.equal(await search.isDisabled(), true, 'a pending quality command should disable competing search');
      assert.equal(fixture.qualityFallbackRequestCount, 1);
      assert.deepEqual(fixture.qualityFallbackRequest.body, {});
      assert.match(fixture.qualityFallbackRequest.csrfToken, /.+/u);
      assert.match(fixture.qualityFallbackRequest.idempotencyKey, /.+/u);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        Promise.resolve().then(() => finishQualityResponse()),
      ]);
      await quality.getByText('Allowed for this recipient', { exact: true }).waitFor();
      await quality.getByText('FLAC, ALAC, WAV, MP3, AAC, Opus, Ogg · lossy audio 320 kbps or higher', { exact: true }).waitFor();
      await quality.getByRole('status').getByText('Fallback quality is allowed for this recipient. A new search is queued using saved automation. Other household quality requirements still apply.', { exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { exact: true, name: 'Current status' }), 'saved quality consent should focus the refreshed current state');
      assert.equal(await quality.getByRole('button', { exact: true, name: 'Allow fallback quality' }).count(), 0);
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      await page.locator('.missing-music-worklist').getByText('Search queued', { exact: true }).waitFor();
      assert.equal(fixture.searchAgainRequestCount, 0);
      assert.equal(fixture.selectionRequest, null);
      assert.equal(fixture.downloadStartRequest, null);
      assert.deepEqual(pageErrors, []);
    }, { scenarioName: 'missing_music_quality_fallback_keyboard_and_layouts' });
  });

  test('quality fallback uses safe retry feedback and verification or disabled history exposes no override', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { qualityChoiceCode: 'below_minimum' });
      fixture.qualityFallbackFailure = true;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const quality = page.getByRole('region', { name: 'Quality', exact: true });
      await quality.getByText('Allow MP3, AAC, Opus, or Ogg at 256 kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.', { exact: true }).waitFor();
      const allow = quality.getByRole('button', { name: 'Allow fallback quality', exact: true });
      await allow.click();
      await quality.getByRole('alert').getByText('The quality choice could not be saved. Refresh this release and try again.', { exact: true }).waitFor();
      const previousKey = fixture.qualityFallbackRequest.idempotencyKey;
      await allow.click();
      assert.equal(fixture.qualityFallbackRequest.idempotencyKey, previousKey);
      assert.equal(fixture.qualityFallbackRequestCount, 2);
      assert.doesNotMatch(await quality.innerText(), /Private|\/mnt/u);

      fixture.qualityChoiceCode = 'needs_verification';
      fixture.qualityFallbackAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await quality.getByText('Needs verification', { exact: true }).waitFor();
      await quality.getByText('Not verified', { exact: true }).waitFor();
      assert.equal(await allow.count(), 0);
      fixture.qualityChoiceCode = 'below_minimum';
      fixture.qualityFallbackAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      await quality.getByText('Below preference', { exact: true }).waitFor();
      assert.equal(await allow.count(), 0);
      assert.equal(fixture.qualityFallbackRequestCount, 2);
    }, { scenarioName: 'missing_music_quality_fallback_safe_feedback' });
  });

  test('selects one visible match without starting a download and returns focus to the updated state', {
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
      const fixture = await installMissingMusicFixture(browserContext, []);
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });

      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Choose a match' }).waitFor();
      await inspector.getByText('10 files found', { exact: true }).waitFor();
      await inspector.getByRole('button', { name: 'Use this match for Amber — match 1' }).click();

      const currentStatus = inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' });
      await currentStatus.waitFor();
      await inspector.getByText('Match selected', { exact: true }).waitFor();
      await inspector.getByText('A download will not start until someone explicitly starts it.', { exact: false }).waitFor();
      await inspector.getByText('Next step: Start download', { exact: true }).waitFor();
      assert.equal(await currentStatus.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.deepEqual(fixture.selectionRequest?.body, {});
      assert.match(fixture.selectionRequest?.csrfToken ?? '', /.+/u);
      assert.match(fixture.selectionRequest?.idempotencyKey ?? '', /.+/u);
      assert.equal(fixture.matchSelected, true);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_match_selection_without_download_start',
    });
  });

  test('confirms one selected match before starting its download preparation', {
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
      const fixture = await installMissingMusicFixture(browserContext, [], { matchSelected: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });

      const inspector = page.locator('.missing-music-inspector');
      const startDownloadButton = inspector.getByRole('button', { name: 'Start download' });
      await startDownloadButton.focus();
      await assertVisibleFocusOutline(startDownloadButton, 'the Start download button focus indicator should be visible');
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Start download?' });
      await dialog.waitFor();
      await dialog.getByText('It will submit the transfer only after the download worker runs.', { exact: false }).waitFor();
      await assertFocusWithin(dialog, 'opening the native confirmation dialog should move focus inside it');
      await assertTabFocusContained(page, dialog, { steps: 4 });

      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(fixture.downloadStartRequest, null);
      await assertLocatorFocused(startDownloadButton, 'dismissing the dialog should return focus to Start download');
      await assertVisibleFocusOutline(startDownloadButton, 'returned Start download focus should remain visible');

      await startDownloadButton.click();
      await dialog.getByRole('button', { name: 'Start download' }).click();

      const currentStatus = inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' });
      await currentStatus.waitFor();
      await inspector.getByText('Download preparation started', { exact: true }).waitFor();
      await inspector.getByText('Download preparation started. Transfer progress will appear in Downloader after it is submitted.', { exact: true }).waitFor();
      assert.equal(await currentStatus.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.deepEqual(fixture.downloadStartRequest?.body, {});
      assert.match(fixture.downloadStartRequest?.csrfToken ?? '', /.+/u);
      assert.match(fixture.downloadStartRequest?.idempotencyKey ?? '', /.+/u);
      assert.equal(fixture.downloadStarted, true);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_download_start_confirmation',
    });
  });

  test('hands an administrator to the release-scoped Downloader view without provider identifiers', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await installMissingMusicFixture(browserContext, [], { downloadStarted: true });
      await installDownloaderBrowserFixtures(browserContext, { queue: buildAmberDownloaderQueue() });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const downloaderLink = inspector.getByRole('link', {
        name: 'View Amber downloads for Jamie in Downloader',
      });
      await downloaderLink.waitFor();
      assert.equal(
        await downloaderLink.getAttribute('href'),
        '/app/downloader?missingMusicDecisionId=wanted-amber',
      );

      await Promise.all([
        page.waitForURL(/\/app\/downloader\?missingMusicDecisionId=wanted-amber$/u),
        downloaderLink.click(),
      ]);
      const downloaderUrl = new URL(page.url());
      assert.deepEqual([...downloaderUrl.searchParams.entries()], [['missingMusicDecisionId', 'wanted-amber']]);
      assert.doesNotMatch(downloaderUrl.href, /healthy-slskd-peer|transfer-downloader-linked/u);

      await page.getByRole('heading', { exact: true, name: 'Downloads for Amber' }).waitFor();
      await page.getByText('Showing live transfers for Amber by Autechre, requested for Jamie.', { exact: true }).waitFor();
      const transferQueue = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await transferQueue.getByText('01 Foil.flac', { exact: true }).waitFor();
      const returnLink = page.getByRole('link', { name: 'Return to Amber in Missing Music' });
      assert.equal(await returnLink.getAttribute('href'), '/app/missing/wanted-amber');
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_to_downloader_handoff',
    });
  });
});
