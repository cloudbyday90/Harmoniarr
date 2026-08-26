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
import {
  createBrowserVisualEvidenceRecorder,
  stabilizeVisualEvidencePage,
} from '../../testing/browser/visual-evidence.js';
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import {
  assertLocatorFocused,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildMusicQueuePayload() {
  const releases = [{
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: 'wanted-downloading',
    matchedTrackCount: 4,
    missingTrackCount: 8,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
      tone: 'success',
    },
    releaseDate: '2024-01-01T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'downloading',
      detail: 'Harmoniarr selected a verified lossless match and is downloading it now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    },
  }, {
    artistName: 'Boards of Canada',
    expectedTrackCount: 10,
    id: 'wanted-quality-stop',
    matchedTrackCount: 10,
    missingTrackCount: 0,
    quality: {
      code: 'needs_verification',
      profile: { code: 'lossless_archive' },
      tone: 'warning',
    },
    releaseDate: '2002-02-18T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Geogaddi',
    status: {
      code: 'quality_choice_needed',
      detail: 'Downloaded audio needs verification before Harmoniarr adds it to your library.',
      label: 'Quality choice needed',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  }];

  return {
    checkedAt: '2026-07-26T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: releases.length },
    releases,
    summary: { counts: { downloading: 1, quality_choice_needed: 1 }, total: releases.length },
  };
}

function buildEmptyMusicQueuePayload() {
  const payload = buildMusicQueuePayload();

  return {
    ...payload,
    pagination: { ...payload.pagination, total: 0 },
    releases: [],
    summary: { counts: {}, total: 0 },
  };
}

function buildRecoveryPayload() {
  const releases = [{
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id: 'wanted-next-match',
    matchedTrackCount: 4,
    missingTrackCount: 8,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'trying_next_match',
      label: 'Trying another match',
      nextAction: 'view_recovery',
      tone: 'info',
    },
  }, {
    artistName: 'Lauren Daigle',
    expectedTrackCount: 12,
    id: 'wanted-retrying-search',
    matchedTrackCount: 0,
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseGroupType: 'Album',
    releaseTitle: 'How Can It Be',
    status: {
      code: 'retrying_search',
      label: 'Searching again automatically',
      nextAction: 'view_recovery',
      tone: 'info',
    },
  }, {
    artistName: 'Boards of Canada',
    expectedTrackCount: 10,
    id: 'wanted-exhausted-search',
    matchedTrackCount: 0,
    missingTrackCount: 10,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseGroupType: 'Album',
    releaseTitle: 'Geogaddi',
    status: {
      code: 'no_matches_left',
      label: 'No matches left',
      nextAction: 'try_again',
      tone: 'warning',
    },
  }];

  return {
    checkedAt: '2026-07-26T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: releases.length },
    releases,
    summary: {
      counts: { no_matches_left: 1, retrying_search: 1, trying_next_match: 1 },
      total: releases.length,
    },
  };
}

function buildMatchChoicePayload() {
  const release = {
    artistName: 'Forest Frank',
    evidence: {
      match: {
        bestCompositeScore: 91,
        matches: [{
          fileCount: 12,
          formats: ['flac'],
          hasFreeUploadSlot: true,
          lockedFileCount: 0,
          matchId: 'match-choice-best',
          queueLength: 0,
          score: 91,
          status: 'pending',
          totalSizeBytes: 123456789,
          trackMatchSummary: {
            expectedTrackCount: 12,
            matchedTrackCount: 12,
          },
          uploadSpeed: 1048576,
        }, {
          fileCount: 12,
          formats: ['flac'],
          hasFreeUploadSlot: false,
          lockedFileCount: 0,
          matchId: 'match-choice-alternate',
          queueLength: 4,
          score: 88,
          status: 'pending',
          totalSizeBytes: 120000000,
          trackMatchSummary: {
            expectedTrackCount: 12,
            matchedTrackCount: 12,
          },
          uploadSpeed: 524288,
        }],
        pendingCount: 2,
        readiness: {
          code: 'ambiguous',
          message: 'Two close matches need a choice before Harmoniarr continues.',
          scoreGap: 3,
        },
        statusCounts: { pending: 2 },
        totalCount: 8,
      },
    },
    expectedTrackCount: 12,
    id: 'wanted-match-choice',
    matchedTrackCount: 0,
    missingTrackCount: 12,
    quality: {
      code: 'accepted',
      formats: ['flac'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac', 'alac', 'wav'],
        fallbackAllowed: false,
        minimumFormats: ['flac', 'alac', 'wav'],
        preferredFormats: ['flac'],
        requiresVerification: true,
        upgradeAllowed: false,
      },
      verifiedLossless: true,
    },
    releaseDate: '2024-01-01T00:00:00.000Z',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    status: {
      code: 'pick_match',
      detail: 'Two close matches need a choice before Harmoniarr continues.',
      label: 'Pick a match',
      nextAction: 'review_matches',
      tone: 'warning',
    },
  };

  return {
    checkedAt: '2026-07-29T12:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [release],
    summary: { counts: { pick_match: 1 }, total: 1 },
  };
}

function buildSelectedMatchPayload() {
  const payload = buildMatchChoicePayload();
  const release = payload.releases[0];
  release.evidence.match.matches[0].status = 'selected';
  release.evidence.match.matches[1].status = 'rejected';
  release.evidence.match.pendingCount = 0;
  release.evidence.match.statusCounts = { rejected: 1, selected: 1 };
  release.status = {
    code: 'checking_matches',
    detail: 'Harmoniarr is preparing the selected match for download.',
    label: 'Checking matches',
    nextAction: 'download_now',
    tone: 'info',
  };
  payload.summary = { counts: { checking_matches: 1 }, total: 1 };
  return payload;
}

async function installMusicQueueReleaseDetailFixture(browserContext, getPayload) {
  await browserContext.route(/\/api\/v1\/acquisition\/releases\/[^/?]+(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const wantedReleaseId = decodeURIComponent(url.pathname.split('/').at(-1));
    const release = getPayload().releases.find((candidate) => candidate.id === wantedReleaseId);

    if (!release) {
      await route.fulfill({
        body: JSON.stringify({ error: { code: 'music_queue_release_not_found' } }),
        contentType: 'application/json',
        status: 404,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ release }),
      contentType: 'application/json',
    });
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue release row hierarchy browser verification', () => {
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

  test('keeps active queue context compact while preserving clear release rows at desktop and mobile widths', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_release_row_hierarchy',
      });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, buildMusicQueuePayload);
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            dependencies: [{ provider: 'slskd', status: 'healthy' }],
          }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Actions' }).waitFor();
      await page.locator('.music-queue-panel-status').filter({ hasText: '1 release has an action available' }).waitFor();
      assert.equal(await page.locator('.music-queue-summary-card').count(), 0);
      const secondaryFilters = page.locator('#music-queue-secondary-filters');
      assert.equal(await secondaryFilters.isHidden(), true);
      await page.getByRole('button', { exact: true, name: 'More filters' }).click();
      assert.equal(await secondaryFilters.isVisible(), true);
      await secondaryFilters.getByLabel('State').selectOption('needs_help');
      await page.getByRole('button', { exact: true, name: 'Hide filters' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Clear filters' }).click();
      assert.equal(await secondaryFilters.isHidden(), true);
      await page.getByLabel('Show releases').selectOption('all');

      const workspace = page.locator('.music-queue-layout');
      const queuePanel = workspace.locator(':scope > .music-queue-panel');
      const reviewPanel = page.locator('.music-queue-review');
      assert.equal(await reviewPanel.count(), 0, 'The release list should not reserve an empty details inspector.');
      assert.equal(
        await workspace.evaluate((element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length),
        1,
        'The unselected Music Queue should use one full-width list column.',
      );
      const fullWidthListPanel = await queuePanel.evaluate((element) => element.getBoundingClientRect().width);

      const rows = page.locator('.music-queue-release-row');
      const downloadingRow = rows.filter({ hasText: 'Child of God' });
      const qualityRow = rows.filter({ hasText: 'Geogaddi' });
      await downloadingRow.getByText('Downloading', { exact: true }).waitFor();
      await downloadingRow.getByText('Quality profile: Lossless archive').waitFor();
      await qualityRow.getByText('Quality choice needed', { exact: true }).waitFor();
      await qualityRow.getByText('Quality: Needs verification').waitFor();
      assert.equal(await rows.locator('.hx-pill').count(), 0);
      assert.equal(await qualityRow.locator('.is-attention').count(), 1);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Release rows prioritize state, outcome, and a single clear quality warning.',
        name: 'desktop-release-rows',
        surface: 'music-queue-release-list',
      });

      await page.evaluate(() => globalThis.document.documentElement.setAttribute('data-theme', 'dark'));
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'The compact queue overview and release rows retain hierarchy in dark mode.',
        name: 'dark-release-rows',
        surface: 'music-queue-release-list',
      });
      await page.evaluate(() => globalThis.document.documentElement.removeAttribute('data-theme'));

      await page.setViewportSize({ height: 844, width: 390 });
      await qualityRow.getByRole('button', { name: 'Review quality choice' }).waitFor();
      await stabilizeVisualEvidencePage(page);
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The mobile release row should not create horizontal overflow.',
      );
      assert.equal(
        await downloadingRow.evaluate((row) => row.getBoundingClientRect().top < globalThis.innerHeight),
        true,
        'The first queued release should remain visible in the initial mobile viewport.',
      );
      await evidence.capture(page, {
        description: 'Release-row context and actions remain readable without horizontal scrolling on mobile.',
        name: 'mobile-release-rows',
        surface: 'music-queue-release-list',
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      const reviewButton = qualityRow.getByRole('button', { name: 'Review quality choice' });
      await reviewButton.focus();
      await reviewButton.press('Enter');
      await reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();
      assert.equal(
        await reviewButton.evaluate((element) => globalThis.document.activeElement === element),
        true,
        'Opening release details should preserve focus on the action that opened them.',
      );
      assert.equal(await reviewButton.getAttribute('aria-controls'), 'music-queue-release-details');
      assert.equal(await reviewButton.getAttribute('aria-expanded'), 'true');
      assert.equal(await reviewPanel.getAttribute('id'), 'music-queue-release-details');
      assert.ok(
        await queuePanel.evaluate((element) => element.getBoundingClientRect().width) < fullWidthListPanel,
        'The selected release inspector should use the second column only after a release is selected.',
      );
      await reviewPanel.getByText('Current status', { exact: true }).waitFor();
      await reviewPanel.getByRole('heading', { name: 'Quality choice needed' }).waitFor();
      await reviewPanel.getByText('Next step:', { exact: false }).waitFor();
      await reviewPanel.getByRole('button', { name: 'Search again' }).waitFor();
      const evidenceToggle = reviewPanel.locator('[aria-controls="music-queue-review-evidence"]');
      await evidenceToggle.scrollIntoViewIfNeeded();
      await evidenceToggle.getByText('Show matching and quality details', { exact: true }).waitFor();
      assert.equal(await evidenceToggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await reviewPanel.getByRole('heading', { name: 'Quality details' }).isVisible(), false);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A stopped release foregrounds its status and the single next decision before diagnostic detail.',
        name: 'desktop-review-outcome',
        surface: 'music-queue-review',
      });

      await evidenceToggle.click();
      assert.equal(await evidenceToggle.getAttribute('aria-expanded'), 'true');
      await reviewPanel.getByRole('heading', { name: 'Match summary' }).waitFor();
      await reviewPanel.getByRole('heading', { name: 'Quality details' }).waitFor();
      await reviewPanel.getByRole('link', { name: 'Advanced diagnostics' }).waitFor();
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Matching and quality evidence remains available only after an intentional disclosure.',
        name: 'desktop-review-evidence',
        surface: 'music-queue-review',
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await reviewPanel.getByRole('heading', { name: 'Quality details' }).waitFor();
      await reviewPanel.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The expanded review evidence should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Expanded release evidence remains readable without horizontal overflow on mobile.',
        name: 'mobile-review-evidence',
        surface: 'music-queue-review',
      });
      await reviewPanel.getByRole('button', { name: 'Close' }).click();
      await reviewPanel.waitFor({ state: 'detached' });
      await assertLocatorFocused(
        reviewButton,
        'Closing a row-opened release inspector should return focus to its row action.',
      );

      await reviewButton.focus();
      await reviewButton.press('Enter');
      await reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();
      await page.getByLabel('Search this queue').fill('Child of God');
      await reviewButton.waitFor({ state: 'detached' });
      await reviewPanel.getByRole('button', { name: 'Close' }).click();
      await reviewPanel.waitFor({ state: 'detached' });
      const filteredQueueHeading = page.getByRole('heading', { exact: true, name: 'All releases' });
      await assertLocatorFocused(
        filteredQueueHeading,
        'Closing after a filter removes the opening row should focus the Music Queue heading.',
      );
      await assertVisibleFocusOutline(
        filteredQueueHeading,
        'The queue heading fallback should expose a visible focus outline after its originating row is removed.',
      );

      await page.goto(`${baseUrl}/app/music-queue/wanted-quality-stop`, { waitUntil: 'domcontentloaded' });
      const directReleaseHeading = reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ });
      await directReleaseHeading.waitFor();
      await assertLocatorFocused(
        directReleaseHeading,
        'A direct Music Queue release URL should focus its loaded inspector heading.',
      );
      await assertVisibleFocusOutline(
        directReleaseHeading,
        'The direct Music Queue inspector heading should expose a visible focus outline.',
      );
      await reviewPanel.getByRole('button', { name: 'Close' }).click();
      await reviewPanel.waitFor({ state: 'detached' });
      const queueListHeading = page.getByRole('heading', { exact: true, name: 'Actions' });
      await assertLocatorFocused(
        queueListHeading,
        'Closing a direct Music Queue release URL should focus the queue heading.',
      );
      await assertVisibleFocusOutline(
        queueListHeading,
        'The returned Music Queue heading should expose a visible focus outline.',
      );
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 6);
    }, { scenarioName: 'music_queue_release_row_hierarchy' });
  });

  test('uses the persistent Music Queue heading when refresh removes every row before Close', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let includesQueuedRows = true;
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(includesQueuedRows ? buildMusicQueuePayload() : buildEmptyMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, buildMusicQueuePayload);
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({ dependencies: [{ provider: 'slskd', status: 'healthy' }] }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const reviewPanel = page.locator('.music-queue-review');
      const queueRow = page.locator('.music-queue-release-row').filter({ hasText: 'Geogaddi' });
      const reviewButton = queueRow.getByRole('button', { name: 'Review quality choice' });
      await reviewButton.click();
      await reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();

      includesQueuedRows = false;
      await page.getByRole('button', { exact: true, name: 'Refresh' }).click();
      await reviewButton.waitFor({ state: 'detached' });
      await reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();
      await reviewPanel.getByRole('button', { exact: true, name: 'Close' }).click();
      await reviewPanel.waitFor({ state: 'detached' });

      const pageHeading = page.locator('.music-queue-header').getByRole('heading', {
        exact: true,
        name: 'Music Queue',
      });
      await assertLocatorFocused(
        pageHeading,
        'Closing after a refresh removes every row should focus the persistent Music Queue heading.',
      );
      await assertVisibleFocusOutline(
        pageHeading,
        'The persistent Music Queue heading should expose a visible focus outline after the queue becomes empty.',
      );
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_release_close_empty_fallback' });
  });

  test('keeps direct release recovery local, actionable, and free of raw request details', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      const slowDetailResponse = createDeferred();
      const retryRelease = {
        ...buildMusicQueuePayload().releases[1],
        id: 'wanted-retryable-detail',
        releaseTitle: 'Tomorrow\'s Harvest',
      };
      let retryRequestCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/[^/?]+(?:\?.*)?$/, async (route) => {
        const url = new URL(route.request().url());
        const wantedReleaseId = decodeURIComponent(url.pathname.split('/').at(-1));

        if (wantedReleaseId === 'wanted-quality-stop') {
          await slowDetailResponse.promise;
          await route.fulfill({
            body: JSON.stringify({ release: buildMusicQueuePayload().releases[1] }),
            contentType: 'application/json',
          });
          return;
        }

        if (wantedReleaseId === 'wanted-not-available') {
          await route.fulfill({
            body: JSON.stringify({ error: { code: 'music_queue_release_not_found' } }),
            contentType: 'application/json',
            status: 404,
          });
          return;
        }

        if (wantedReleaseId === 'wanted-retryable-detail') {
          retryRequestCount += 1;
          if (retryRequestCount === 1) {
            await route.fulfill({
              body: JSON.stringify({
                error: {
                  code: 'upstream_unavailable',
                  message: 'Provider https://provider.example/internal-release is unavailable.',
                },
              }),
              contentType: 'application/json',
              status: 503,
            });
            return;
          }

          await route.fulfill({
            body: JSON.stringify({ release: retryRelease }),
            contentType: 'application/json',
          });
          return;
        }

        await route.fulfill({
          body: JSON.stringify({ error: { code: 'music_queue_release_not_found' } }),
          contentType: 'application/json',
          status: 404,
        });
      });
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({ dependencies: [{ provider: 'slskd', status: 'healthy' }] }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
          response,
        });
      });

      const reviewPanel = page.locator('.music-queue-review');
      await page.goto(`${baseUrl}/app/music-queue/wanted-quality-stop`, { waitUntil: 'domcontentloaded' });
      const loadingHeading = reviewPanel.getByRole('heading', { exact: true, name: 'Loading release details' });
      await loadingHeading.waitFor();
      assert.equal(await reviewPanel.getAttribute('aria-busy'), 'true');
      await reviewPanel.getByRole('button', { exact: true, name: 'Close' }).waitFor();

      slowDetailResponse.resolve();
      const loadedHeading = reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ });
      await loadedHeading.waitFor();
      await assertLocatorFocused(
        loadedHeading,
        'A direct release URL should focus the loaded inspector only after its slow detail request resolves.',
      );

      await page.goto(`${baseUrl}/app/music-queue/wanted-not-available`, { waitUntil: 'domcontentloaded' });
      const unavailableHeading = reviewPanel.getByRole('heading', { exact: true, name: 'Release not available' });
      await unavailableHeading.waitFor();
      await assertLocatorFocused(
        unavailableHeading,
        'An unavailable direct release should focus the recovery heading after it renders.',
      );
      await assertVisibleFocusOutline(
        unavailableHeading,
        'The unavailable recovery heading should expose a visible focus outline.',
      );
      await reviewPanel.getByRole('status').getByText('Release not available.', { exact: true }).waitFor();
      await reviewPanel.getByRole('button', { exact: true, name: 'Return to Music Queue' }).click();
      await reviewPanel.waitFor({ state: 'detached' });
      await assertLocatorFocused(
        page.getByRole('heading', { exact: true, name: 'Actions' }),
        'Returning from an unavailable direct release should focus the queue heading.',
      );

      await page.goto(`${baseUrl}/app/music-queue/wanted-retryable-detail`, { waitUntil: 'domcontentloaded' });
      const retryHeading = reviewPanel.getByRole('heading', { exact: true, name: 'Release details unavailable' });
      await retryHeading.waitFor();
      await assertLocatorFocused(
        retryHeading,
        'A temporary direct release failure should focus its recovery heading.',
      );
      await assertVisibleFocusOutline(
        retryHeading,
        'The temporary failure recovery heading should expose a visible focus outline.',
      );
      await reviewPanel.getByRole('alert').getByText('Release details could not be loaded.', { exact: true }).waitFor();
      assert.equal(
        await page.getByText('Provider https://provider.example/internal-release is unavailable.').count(),
        0,
        'Raw provider failures must not be rendered in Music Queue.',
      );
      const retryButton = reviewPanel.getByRole('button', { exact: true, name: 'Try again' });
      await retryButton.focus();
      await retryButton.press('Enter');
      await reviewPanel.getByRole('heading', { name: /Tomorrow's Harvest by Boards of Canada/ }).waitFor();
      const retryOutcomeHeading = reviewPanel.locator('#music-queue-review-status');
      await retryOutcomeHeading.waitFor();
      await page.waitForFunction(() => (
        globalThis.document.activeElement?.id === 'music-queue-review-status'
      ));
      await assertLocatorFocused(
        retryOutcomeHeading,
        'Retrying release details should focus the updated outcome when Try again is replaced.',
      );
      await assertVisibleFocusOutline(
        retryOutcomeHeading,
        'The retry outcome should show a visible focus outline after Try again is replaced.',
      );
      assert.equal(retryRequestCount, 2, 'Try again should repeat only the selected release-detail request.');
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_direct_release_recovery' });
  });

  test('separates automatic recovery from stopped-release decisions without duplicate actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_stopped_release_recovery',
      });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildRecoveryPayload()),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, buildRecoveryPayload);
      await browserContext.route('**/api/v1/system/overview', async (route) => {
        await route.fulfill({
          body: JSON.stringify({ dependencies: [{ provider: 'slskd', status: 'healthy' }] }),
          contentType: 'application/json',
        });
      });
      await browserContext.route('**/api/v1/settings', async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.secretStatus ??= {};
        payload.secretStatus.slskd = {
          ...(payload.secretStatus.slskd ?? {}),
          providerMode: 'external',
          providerModeState: 'configured',
        };
        await route.fulfill({ body: JSON.stringify(payload), contentType: 'application/json', response });
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      const settingsResponse = page.waitForResponse((response) => response.url().includes('/api/v1/settings'));
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      await settingsResponse;
      await page.getByRole('heading', { exact: true, name: 'Actions' }).waitFor();
      await page.getByLabel('Show releases').selectOption('all');
      await page.getByRole('heading', { exact: true, name: 'All releases' }).waitFor();

      const rows = page.locator('.music-queue-release-row');
      const nextMatchRow = rows.filter({ hasText: 'Child of God' });
      const retryingSearchRow = rows.filter({ hasText: 'How Can It Be' });
      const exhaustedRow = rows.filter({ hasText: 'Geogaddi' });
      await nextMatchRow.getByText('Trying another match', { exact: true }).waitFor();
      await retryingSearchRow.getByText('Searching again automatically', { exact: true }).waitFor();
      await exhaustedRow.getByText('No matches left', { exact: true }).waitFor();
      await nextMatchRow.getByText('moving to the next eligible match automatically', { exact: false }).waitFor();
      await retryingSearchRow.getByText('try again automatically', { exact: false }).waitFor();
      await exhaustedRow.getByText('stopped automatic recovery', { exact: false }).waitFor();
      assert.equal(await nextMatchRow.getByRole('button', { name: 'Details' }).count(), 0);
      assert.equal(await retryingSearchRow.getByRole('button', { name: 'Details' }).count(), 0);
      assert.equal(await exhaustedRow.getByRole('button', { name: 'Details' }).count(), 0);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Music Queue identifies automatic recovery separately from a stopped release that needs one decision.',
        name: 'desktop-recovery-rows',
        surface: 'music-queue-release-list',
      });

      await nextMatchRow.getByRole('button', { name: 'View recovery' }).click();
      const reviewPanel = page.locator('.music-queue-review');
      await reviewPanel.getByRole('heading', { name: 'Child of God by Forest Frank' }).waitFor();
      await reviewPanel.getByText('No action is needed. Harmoniarr will continue this release automatically.').waitFor();
      assert.equal(await reviewPanel.getByRole('button', { name: 'Try again' }).count(), 0);
      assert.equal(await reviewPanel.getByRole('button', { name: 'Search again' }).count(), 0);

      await exhaustedRow.getByRole('button', { name: 'Review recovery' }).click();
      await reviewPanel.getByRole('heading', { name: 'Geogaddi by Boards of Canada' }).waitFor();
      await reviewPanel.getByText('Review the result, then choose Search again to begin a new search.').waitFor();
      await reviewPanel.getByRole('button', { name: 'Search again' }).waitFor();
      assert.equal(await reviewPanel.getByRole('button', { name: 'Try again' }).count(), 0);
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A stopped release provides a single clear recovery action before optional diagnostics.',
        name: 'desktop-stopped-recovery',
        surface: 'music-queue-review',
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await reviewPanel.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'Recovery rows and their focused action should not create mobile horizontal overflow.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'The stopped-release recovery action remains readable on a narrow viewport.',
        name: 'mobile-stopped-recovery',
        surface: 'music-queue-review',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 3);
    }, { scenarioName: 'music_queue_stopped_release_recovery' });
  });

  test('keeps actionable match evidence optional while preserving keyboard and mobile access', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_match_decision_evidence',
      });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMatchChoicePayload()),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, buildMatchChoicePayload);
      await installConfiguredMusicQueueProviderFixtures(browserContext);

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'Review matches' }).click();

      const reviewPanel = page.locator('.music-queue-review');
      const decisionCard = reviewPanel.locator('.music-queue-review-match').filter({ hasText: 'Match 1' });
      await reviewPanel.getByText(
        'Showing 2 highest-ranked matches of 8 candidates. Select a match only when it fits this release and your quality policy.',
        { exact: true },
      ).waitFor();
      await decisionCard.getByRole('button', { exact: true, name: 'Use this match: Match 1' }).waitFor();
      await decisionCard.getByRole('button', { exact: true, name: 'Reject match: Match 1' }).waitFor();
      await decisionCard.getByText('Quality', { exact: true }).waitFor();
      await decisionCard.getByText('Format', { exact: true }).waitFor();
      await decisionCard.getByText('Tracks', { exact: true }).waitFor();
      assert.equal(await decisionCard.getByText('Score', { exact: true }).isVisible(), false);
      assert.equal(await decisionCard.getByText('Source health', { exact: true }).isVisible(), false);

      const matchDetails = decisionCard.locator('details.music-queue-review-match__details');
      assert.equal(await matchDetails.evaluate((element) => element.open), false);
      await decisionCard.getByRole('button', { exact: true, name: 'Use this match: Match 1' }).focus();
      await decisionCard.getByRole('button', { exact: true, name: 'Use this match: Match 1' }).press('Tab');
      await decisionCard.getByRole('button', { exact: true, name: 'Reject match: Match 1' }).press('Tab');
      assert.equal(
        await matchDetails.locator('summary').evaluate((element) => globalThis.document.activeElement === element),
        true,
        'Keyboard focus should reach match evidence after the action controls.',
      );
      await matchDetails.locator('summary').press('Space');
      await page.waitForFunction(() =>
        globalThis.document.querySelector('details.music-queue-review-match__details')?.open === true,
      );
      await decisionCard.getByText('Score', { exact: true }).waitFor();
      await decisionCard.getByText('Files', { exact: true }).waitFor();
      await decisionCard.getByText('Size', { exact: true }).waitFor();
      await decisionCard.getByText('Source health', { exact: true }).waitFor();
      await decisionCard.getByText('Observed', { exact: true }).waitFor();
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'Actionable match cards lead with selection facts and actions; complete evidence appears only after an intentional expansion.',
        name: 'desktop-match-decision-details',
        surface: 'music-queue-review',
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await decisionCard.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'Expanded match evidence should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'The actionable match and optional evidence remain readable on a narrow viewport.',
        name: 'mobile-match-decision-details',
        surface: 'music-queue-review',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
    }, { scenarioName: 'music_queue_match_decision_evidence' });
  });

  test('keeps action feedback inside the selected release review through progress, success, and failure', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_release_action_feedback',
      });
      const pageErrors = [];
      const useMatchResponse = createDeferred();
      let alternateUseRequestCount = 0;
      let bestUseRequestCount = 0;
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMatchChoicePayload()),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, buildMatchChoicePayload);
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/wanted-match-choice\/matches\/match-choice-best\/use$/, async (route) => {
        bestUseRequestCount += 1;
        await useMatchResponse.promise;
        await route.fulfill({
          body: JSON.stringify({ ok: true }),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/wanted-match-choice\/matches\/match-choice-alternate\/use$/, async (route) => {
        alternateUseRequestCount += 1;
        await route.fulfill({
          body: JSON.stringify({ ok: true }),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/wanted-match-choice\/matches\/match-choice-best\/reject$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            error: {
              code: 'match_unavailable',
              message: 'That match is no longer available. Choose another match or search again.',
            },
          }),
          contentType: 'application/json',
          status: 409,
        });
      });
      await installConfiguredMusicQueueProviderFixtures(browserContext);

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'Review matches' }).click();

      const reviewPanel = page.locator('.music-queue-review');
      const decisionCard = reviewPanel.locator('.music-queue-review-match').filter({ hasText: 'Match 1' });
      const alternateDecisionCard = reviewPanel.locator('.music-queue-review-match').filter({ hasText: 'Match 2' });
      const useButton = decisionCard.getByRole('button', { name: 'Use this match' });
      const useButtonFocusTarget = decisionCard.locator('.music-queue-review-match__actions button').first();
      const rejectButton = decisionCard.getByRole('button', { name: 'Reject match' });
      const alternateUseButton = alternateDecisionCard.getByRole('button', { name: 'Use this match' });
      const statusFeedback = reviewPanel.locator('.music-queue-review__action-feedback[role="status"]');
      const errorFeedback = reviewPanel.locator('.music-queue-review__action-feedback[role="alert"]');
      const confirmationDialog = page.getByRole('alertdialog', { name: 'Use this match for Child of God?' });

      await useButton.focus();
      await useButton.press('Enter');
      await confirmationDialog.waitFor();
      await confirmationDialog.getByText(
        'Harmoniarr will save this match for Child of God. It will check the match before it can queue a download.',
        { exact: true },
      ).waitFor();
      assert.equal(await alternateUseButton.isDisabled(), false);
      assert.equal(alternateUseRequestCount, 0);
      assert.equal(bestUseRequestCount, 0);
      await confirmationDialog.getByRole('button', { name: 'Keep reviewing' }).click();
      await confirmationDialog.waitFor({ state: 'detached' });
      assert.equal(
        await useButtonFocusTarget.evaluate((element) => globalThis.document.activeElement === element),
        true,
        'Cancelling a match selection should return focus to the originating action.',
      );
      assert.equal(alternateUseRequestCount, 0);
      assert.equal(bestUseRequestCount, 0);

      const useMatchRequest = page.waitForRequest((request) => request.url().endsWith(
        '/api/v1/acquisition/releases/wanted-match-choice/matches/match-choice-best/use',
      ));
      await useButton.press('Enter');
      await confirmationDialog.waitFor();
      await confirmationDialog.getByRole('button', { name: 'Use this match' }).click();
      await useMatchRequest;
      assert.equal(bestUseRequestCount, 1);
      await statusFeedback.getByText('Working', { exact: true }).waitFor();
      await statusFeedback.getByText('Using this match...', { exact: true }).waitFor();
      assert.equal(await useButtonFocusTarget.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.equal(await useButtonFocusTarget.getAttribute('aria-disabled'), 'true');
      assert.equal(await useButtonFocusTarget.getAttribute('aria-describedby'), 'music-queue-review-action-feedback');
      assert.equal(await alternateUseButton.isDisabled(), true);
      assert.equal(alternateUseRequestCount, 0);
      assert.equal(await page.locator('.music-queue-view > .hx-alert').filter({ hasText: 'Using this match...' }).count(), 0);

      useMatchResponse.resolve();
      await statusFeedback.getByText('Updated', { exact: true }).waitFor();
      await statusFeedback.getByText('Match selected. Harmoniarr will update this release as it prepares the next step.', { exact: true }).waitFor();
      await page.waitForFunction(() => (
        globalThis.document.querySelector('[data-music-queue-action="use-match:match-choice-alternate"]')
          ?.disabled === false
      ));
      assert.equal(
        await useButtonFocusTarget.evaluate((element) => globalThis.document.activeElement === element),
        true,
        'A completed action that remains available should retain keyboard focus.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A successful match action is announced inside the selected release review, not above the queue.',
        name: 'desktop-release-action-success',
        surface: 'music-queue-review',
      });

      await rejectButton.focus();
      await rejectButton.press('Enter');
      await errorFeedback.getByText('Could not continue', { exact: true }).waitFor();
      await errorFeedback.getByText('That match is no longer available. Choose another match or search again.', { exact: true }).waitFor();
      assert.equal(await rejectButton.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.equal(await page.locator('.music-queue-view > .hx-alert').filter({ hasText: 'That match is no longer available.' }).count(), 0);

      await page.setViewportSize({ height: 844, width: 390 });
      await errorFeedback.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'Release action feedback should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A failed action remains attached to the selected release and readable on a narrow viewport.',
        name: 'mobile-release-action-failure',
        surface: 'music-queue-review',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
    }, { scenarioName: 'music_queue_release_action_feedback' });
  });

  test('shows the scheduled automatic handoff in the release row after a successful match selection', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'music_queue_release_row_transition_clarity',
      });
      const pageErrors = [];
      let payload = buildMatchChoicePayload();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(payload),
          contentType: 'application/json',
        });
      });
      await installMusicQueueReleaseDetailFixture(browserContext, () => payload);
      await browserContext.route('**/api/v1/acquisition/releases/wanted-match-choice/matches/match-choice-best/use', async (route) => {
        payload = buildSelectedMatchPayload();
        await route.fulfill({
          body: JSON.stringify({ ok: true, release: payload.releases[0] }),
          contentType: 'application/json',
        });
      });
      await installConfiguredMusicQueueProviderFixtures(browserContext);

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'Review matches' }).click();

      const reviewPanel = page.locator('.music-queue-review');
      const selectedMatchCard = reviewPanel.locator('.music-queue-review-match').filter({ hasText: 'Match 1' });
      const useMatchButton = selectedMatchCard.getByRole('button', { name: 'Use this match' });
      await useMatchButton.focus();
      await useMatchButton.press('Enter');
      const confirmationDialog = page.getByRole('alertdialog', { name: 'Use this match for Child of God?' });
      await confirmationDialog.waitFor();
      await confirmationDialog.getByRole('button', { name: 'Use this match' }).click();
      const updatedOutcomeHeading = reviewPanel.getByRole('heading', { exact: true, name: 'Checking matches' });
      await updatedOutcomeHeading.waitFor();
      await page.waitForFunction(() => (
        globalThis.document.activeElement?.id === 'music-queue-review-status'
      ));
      await assertLocatorFocused(
        updatedOutcomeHeading,
        'Selecting a match should focus the updated outcome when the invoked action is removed.',
      );
      await assertVisibleFocusOutline(
        updatedOutcomeHeading,
        'The updated outcome should show a visible focus outline after the match action is removed.',
      );
      await page.getByLabel('Show releases').selectOption('in-progress');
      await releaseRow.getByText('Checking matches', { exact: true }).waitFor();
      await releaseRow.getByText('Up next', { exact: true }).waitFor();
      await releaseRow.getByText(
        'Harmoniarr will automatically queue the selected match for download when its checks finish.',
        { exact: true },
      ).waitFor();
      await reviewPanel.getByRole('button', { name: 'Close' }).click();
      await reviewPanel.waitFor({ state: 'detached' });
      await releaseRow.getByText('Checking matches', { exact: true }).waitFor();
      await releaseRow.getByText('Up next', { exact: true }).waitFor();
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'A successful match choice updates the release row with its now-scheduled automatic download handoff without reopening details.',
        name: 'desktop-release-row-transition',
        surface: 'music-queue-release-list',
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await releaseRow.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
        true,
        'The release-row automatic handoff should not create horizontal overflow on mobile.',
      );
      await stabilizeVisualEvidencePage(page);
      await evidence.capture(page, {
        description: 'The compact automatic handoff remains readable in a narrow Music Queue release row.',
        name: 'mobile-release-row-transition',
        surface: 'music-queue-release-list',
      });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 2);
    }, { scenarioName: 'music_queue_release_row_transition_clarity' });
  });
});
