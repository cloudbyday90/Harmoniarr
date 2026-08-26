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
import {
  buildLinkedDownloaderQueueFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildDecision({ downloadStarted = false, matchSelected = false } = {}) {
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
      accountStatus: 'active',
      id: 'listener-1',
      username: 'Jamie',
    },
    status: downloadStarted
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
  downloadStarted = false,
  matchSelected = false,
} = {}) {
  const state = {
    downloadStartRequest: null,
    downloadStarted,
    matchSelected,
    selectionRequest: null,
  };

  await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl.pathname);
    const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
    const selectionPath = `${detailPath}/matches/candidate-amber/select`;
    const downloadStartPath = `${detailPath}/start-download`;
    const downloaderHandoffPath = `${detailPath}/downloader-handoff`;

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
          downloadStarted: state.downloadStarted,
          matchSelected: state.matchSelected,
        }),
        matchChoices: state.matchSelected
          ? []
          : [{
            fileCount: 10,
            formats: ['FLAC'],
            id: 'candidate-amber',
            totalSizeBytes: 358000000,
          }],
        permissions: {
          canSelectMatch: !state.matchSelected,
          canStartDownload: state.matchSelected && !state.downloadStarted,
          canViewDownloader: state.downloadStarted,
          isReadOnly: false,
        },
        scope: 'all',
      }
      : buildWorklistPayload();

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
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();

      const heading = page.getByRole('heading', { exact: true, level: 2, name: 'Amber' });
      await heading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing/wanted-amber');
      assert.equal(await heading.evaluate((element) => globalThis.document.activeElement === element), true);
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' }).waitFor();
      await inspector.getByText('Jamie', { exact: true }).waitFor();
      await inspector.getByText('Next step:', { exact: false }).waitFor();
      assert.ok(requests.includes('/api/v1/missing-music/decisions/wanted-amber'));

      await page.getByRole('link', { name: 'Back to release decisions' }).click();
      await page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing');
    }, {
      scenarioName: 'missing_music_decision_detail_navigation',
    });
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
      await inspector.getByRole('button', { name: 'Start download' }).click();
      const dialog = page.getByRole('dialog', { name: 'Start download?' });
      await dialog.waitFor();
      await dialog.getByText('It will submit the transfer only after the download worker runs.', { exact: false }).waitFor();

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      assert.equal(await dialog.isVisible(), false);
      assert.equal(fixture.downloadStartRequest, null);

      await inspector.getByRole('button', { name: 'Start download' }).click();
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
        '/app/acquisition/downloader?missingMusicDecisionId=wanted-amber',
      );

      await Promise.all([
        page.waitForURL(/\/app\/acquisition\/downloader\?missingMusicDecisionId=wanted-amber$/u),
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
