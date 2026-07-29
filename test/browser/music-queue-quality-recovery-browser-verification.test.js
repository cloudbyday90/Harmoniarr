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
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const wantedReleaseId = 'wanted-quality-recovery-release';

const RECOVERY_STAGES = Object.freeze([
  Object.freeze({
    code: 'trying_next_match',
    detail: 'A previous match did not work. Harmoniarr is moving to the next eligible match automatically.',
    label: 'Trying another match',
    nextAction: 'view_recovery',
    tone: 'info',
  }),
  Object.freeze({
    code: 'downloading',
    detail: 'Harmoniarr selected the next verified lossless match and is downloading it now.',
    label: 'Downloading',
    nextAction: 'open_downloader',
    tone: 'info',
  }),
]);

const TERMINAL_QUALITY_STAGE = Object.freeze({
  code: 'quality_choice_needed',
  detail: 'A downloaded match did not pass verified lossless checks, and no other safe match is available.',
  label: 'Quality choice needed',
  nextAction: 'review_quality_choice',
  tone: 'warning',
});

function buildMusicQueuePayload(stage) {
  return {
    checkedAt: '2026-07-26T22:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Forest Frank',
      expectedTrackCount: 12,
      id: wantedReleaseId,
      matchedTrackCount: 0,
      missingTrackCount: 12,
      quality: {
        code: stage.code === 'quality_choice_needed' ? 'needs_verification' : 'accepted',
        profile: { code: 'lossless_archive' },
        tone: stage.tone,
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Child of God',
      status: stage,
    }],
    summary: { counts: { [stage.code]: 1 }, total: 1 },
  };
}

function buildRecoveryActivityPayload() {
  return {
    checkedAt: '2026-07-26T22:00:00.000Z',
    events: [{
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'music_queue_match_retrying',
      extraPayload: { wantedReleaseId },
      id: 'quality-recovery-started',
      occurredAt: '2026-07-26T21:59:00.000Z',
    }, {
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'music_queue_quality_blocked',
      extraPayload: {
        message: 'Downloaded audio did not pass verified lossless checks.',
        wantedReleaseId,
      },
      id: 'quality-recovery-blocked',
      occurredAt: '2026-07-26T21:58:00.000Z',
    }],
    ok: true,
    total: 2,
  };
}

function buildTerminalQualityActivityPayload() {
  return {
    checkedAt: '2026-07-26T22:00:00.000Z',
    events: [{
      entityArtist: 'Forest Frank',
      entityId: wantedReleaseId,
      entityTitle: 'Child of God',
      entityType: 'wanted_release',
      eventType: 'music_queue_quality_blocked',
      extraPayload: {
        message: 'A downloaded match did not pass verified lossless checks, and no other safe match is available.',
        wantedReleaseId,
      },
      id: 'quality-recovery-exhausted',
      occurredAt: '2026-07-26T21:57:00.000Z',
    }],
    ok: true,
    total: 1,
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue strict-quality recovery browser verification', () => {
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

  test('continues with the next safe match and stops clearly only after quality recovery is exhausted', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      let activityMode = 'recovery';
      let recoveryStageIndex = 0;
      let terminalQualityStop = false;
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      await installConfiguredMusicQueueProviderFixtures(browserContext);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        const stage = terminalQualityStop
          ? TERMINAL_QUALITY_STAGE
          : RECOVERY_STAGES[Math.min(recoveryStageIndex++, RECOVERY_STAGES.length - 1)];
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload(stage)),
          contentType: 'application/json',
        });
      });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          body: JSON.stringify(
            activityMode === 'recovery'
              ? buildRecoveryActivityPayload()
              : buildTerminalQualityActivityPayload(),
          ),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      const releaseRow = page.getByRole('listitem').filter({ hasText: 'Child of God' });
      const details = page.getByRole('complementary', { name: 'Music Queue details' });

      await releaseRow.getByText('Trying another match', { exact: true }).waitFor();
      await releaseRow.getByText('moving to the next eligible match automatically', { exact: false }).waitFor();
      await releaseRow.getByRole('button', { name: 'View recovery' }).click();
      await details.getByRole('heading', { name: 'Child of God by Forest Frank' }).waitFor();
      await details.getByText('No action is needed. Harmoniarr will continue this release automatically.').waitFor();
      assert.equal(await details.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
      assert.doesNotMatch(await page.locator('.music-queue-view').innerText(), /\bcandidate(?:s)?\b/i);

      await page.getByRole('button', { name: 'Refresh' }).click();
      await releaseRow.getByText('Downloading', { exact: true }).waitFor();
      await releaseRow.getByRole('link', { name: 'Open Downloader' }).waitFor();
      assert.equal(await releaseRow.getByRole('button', { name: 'Review quality choice' }).count(), 0);

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Activity timeline' }).waitFor();
      const recoveryStory = page.locator('.activity-timeline-item').filter({
        hasText: 'Trying the next best match: Child of God by Forest Frank',
      });
      await recoveryStory.getByText('Trying the next best match: Child of God by Forest Frank').waitFor();
      await recoveryStory.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
      await recoveryStory.getByRole('link', { name: 'Open Music Queue' }).waitFor();
      assert.doesNotMatch(await recoveryStory.innerText(), /\bcandidate(?:s)?\b/i);
      assert.equal(await recoveryStory.getByRole('link', { name: /diagnostic/i }).count(), 0);

      terminalQualityStop = true;
      activityMode = 'terminal';
      await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
      await releaseRow.getByText('Quality choice needed', { exact: true }).waitFor();
      await releaseRow.getByText('no other safe match is available', { exact: false }).waitFor();
      await releaseRow.getByRole('button', { name: 'Review quality choice' }).waitFor();
      assert.equal(await releaseRow.getByRole('link', { name: 'Open Downloader' }).count(), 0);
      assert.equal(await releaseRow.getByRole('button', { name: 'View recovery' }).count(), 0);

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const qualityStop = page.locator('.activity-timeline-item').filter({
        hasText: 'Quality choice needed: Child of God by Forest Frank',
      });
      await qualityStop.getByText('no other safe match is available', { exact: false }).waitFor();
      await qualityStop.getByRole('link', { name: 'Review quality choice' }).waitFor();
      assert.equal(await qualityStop.getByRole('link', { name: /diagnostic/i }).count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_strict_quality_recovery' });
  });
});
