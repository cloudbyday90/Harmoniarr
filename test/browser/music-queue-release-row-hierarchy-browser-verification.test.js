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
        totalCount: 2,
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
      await page.getByRole('heading', { exact: true, name: 'Current work' }).waitFor();
      await page.locator('.music-queue-panel-status').filter({ hasText: '1 release needs attention' }).waitFor();
      assert.equal(await page.locator('.music-queue-summary-card').count(), 0);
      const secondaryFilters = page.locator('#music-queue-secondary-filters');
      assert.equal(await secondaryFilters.isHidden(), true);
      await page.getByRole('button', { exact: true, name: 'Filters' }).click();
      assert.equal(await secondaryFilters.isVisible(), true);
      await secondaryFilters.getByLabel('State').selectOption('needs_help');
      await page.getByRole('button', { exact: true, name: 'Filters active' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Clear' }).click();
      assert.equal(await secondaryFilters.isHidden(), true);

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
      await qualityRow.getByRole('button', { name: 'Review quality choice' }).click();
      const reviewPanel = page.locator('.music-queue-review');
      await reviewPanel.getByRole('heading', { name: /Geogaddi by Boards of Canada/ }).waitFor();
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
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 6);
    }, { scenarioName: 'music_queue_release_row_hierarchy' });
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
      await page.getByRole('heading', { exact: true, name: 'Current work' }).waitFor();
      await page.getByLabel('Show').selectOption('all');
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
      await installConfiguredMusicQueueProviderFixtures(browserContext);

      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.locator('.music-queue-release-row').filter({ hasText: 'Child of God' });
      await releaseRow.getByRole('button', { name: 'Review matches' }).click();

      const reviewPanel = page.locator('.music-queue-review');
      const decisionCard = reviewPanel.locator('.music-queue-review-match').filter({ hasText: 'Match 1' });
      await decisionCard.getByRole('button', { name: 'Use this match' }).waitFor();
      await decisionCard.getByRole('button', { name: 'Reject match' }).waitFor();
      await decisionCard.getByText('Quality', { exact: true }).waitFor();
      await decisionCard.getByText('Format', { exact: true }).waitFor();
      await decisionCard.getByText('Tracks', { exact: true }).waitFor();
      assert.equal(await decisionCard.getByText('Score', { exact: true }).isVisible(), false);
      assert.equal(await decisionCard.getByText('Source health', { exact: true }).isVisible(), false);

      const matchDetails = decisionCard.locator('details.music-queue-review-match__details');
      assert.equal(await matchDetails.evaluate((element) => element.open), false);
      await decisionCard.getByRole('button', { name: 'Use this match' }).focus();
      await decisionCard.getByRole('button', { name: 'Use this match' }).press('Tab');
      await decisionCard.getByRole('button', { name: 'Reject match' }).press('Tab');
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
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(buildMatchChoicePayload()),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/acquisition\/releases\/wanted-match-choice\/matches\/match-choice-best\/use$/, async (route) => {
        await useMatchResponse.promise;
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
      const useButton = decisionCard.getByRole('button', { name: 'Use this match' });
      const useButtonFocusTarget = decisionCard.locator('.music-queue-review-match__actions button').first();
      const rejectButton = decisionCard.getByRole('button', { name: 'Reject match' });
      const statusFeedback = reviewPanel.locator('.music-queue-review__action-feedback[role="status"]');
      const errorFeedback = reviewPanel.locator('.music-queue-review__action-feedback[role="alert"]');
      const useMatchRequest = page.waitForRequest((request) => request.url().endsWith(
        '/api/v1/acquisition/releases/wanted-match-choice/matches/match-choice-best/use',
      ));

      await useButton.focus();
      await useButton.press('Enter');
      await useMatchRequest;
      await statusFeedback.getByText('Working', { exact: true }).waitFor();
      await statusFeedback.getByText('Using this match...', { exact: true }).waitFor();
      assert.equal(await useButtonFocusTarget.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.equal(await page.locator('.music-queue-view > .hx-alert').filter({ hasText: 'Using this match...' }).count(), 0);

      useMatchResponse.resolve();
      await statusFeedback.getByText('Updated', { exact: true }).waitFor();
      await statusFeedback.getByText('Match selected. Harmoniarr will use it for the next download step.', { exact: true }).waitFor();
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
});
