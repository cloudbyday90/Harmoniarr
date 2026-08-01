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
  installMusicQueueTerminalRecoveryReadModelFixtures,
  MUSIC_QUEUE_TERMINAL_RECOVERY_CASES,
} from '../../testing/browser/music-queue-terminal-recovery-browser-fixtures.js';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { installConfiguredMusicQueueProviderFixtures } from '../../testing/browser/music-queue-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const AUTOMATIC_RECOVERY_CASES = MUSIC_QUEUE_TERMINAL_RECOVERY_CASES.filter((scenario) => scenario.automatic);
const STOP_CASES = MUSIC_QUEUE_TERMINAL_RECOVERY_CASES.filter((scenario) => !scenario.automatic);

let browserRuntime;
let runtimeUnavailableReason = null;

function getReleaseRow(page, scenario) {
  return page.getByRole('listitem').filter({ hasText: scenario.releaseTitle });
}

function getActivityEntry(page, scenario) {
  return page.locator('.activity-timeline-item').filter({ hasText: scenario.releaseTitle });
}

function assertNoNormalSurfaceDiagnostics(text) {
  assert.doesNotMatch(text, /\bcandidate(?:s)?\b/i);
  assert.doesNotMatch(text, /download_timed_out|source_disappeared|quality_failed|import_blocked/i);
  assert.doesNotMatch(text, /\/downloads\/|[A-Z]:\\/i);
}

async function bootstrapTerminalRecoveryScenario({ baseUrl, browserContext, page, scenario }) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await bootstrapAdminThroughUi(page, { baseUrl });
  await installConfiguredMusicQueueProviderFixtures(browserContext);
  const readModel = await installMusicQueueTerminalRecoveryReadModelFixtures(browserContext, scenario);

  return { pageErrors, readModel };
}

suite('Music Queue terminal recovery browser acceptance', () => {
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

  for (const scenario of AUTOMATIC_RECOVERY_CASES) {
    test(`${scenario.key} continues automatically through the normal Music Queue and Activity handoffs`, {
      timeout: integrationRuntimeConfig.scenarioTimeoutMs,
    }, async (t) => {
      if (runtimeUnavailableReason) {
        t.skip(runtimeUnavailableReason);
        return;
      }

      await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
        const { pageErrors, readModel } = await bootstrapTerminalRecoveryScenario({
          baseUrl,
          browserContext,
          page,
          scenario,
        });

        await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
        const releaseRow = getReleaseRow(page, scenario);
        const details = page.getByRole('complementary', { name: 'Music Queue details' });

        await releaseRow.getByText('Trying another match', { exact: true }).waitFor();
        await releaseRow.getByRole('button', { name: 'View recovery' }).click();
        await details.getByRole('heading', { name: `${scenario.releaseTitle} by ${scenario.artistName}` }).waitFor();
        await details.getByText('No action is needed. Harmoniarr will continue this release automatically.').waitFor();
        assert.equal(await details.getByRole('link', { name: 'Advanced diagnostics' }).count(), 0);
        assertNoNormalSurfaceDiagnostics(await page.getByRole('main').innerText());

        await releaseRow.getByText('Downloading', { exact: true }).waitFor({ timeout: 15_000 });
        await releaseRow.getByRole('link', { name: 'Open Downloader' }).waitFor();
        assert.ok(readModel.getReleaseReadCount() >= 2, 'automatic recovery must revalidate without pressing Refresh');
        assert.equal(await releaseRow.getByRole('button', { name: 'Review quality choice' }).count(), 0);

        await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
        const activity = getActivityEntry(page, scenario);
        await activity.getByText(`Trying the next best match: ${scenario.releaseTitle} by ${scenario.artistName}`).waitFor();
        await activity.getByText('A download failed. Harmoniarr is trying the next best match.').waitFor();
        await activity.getByRole('link', { name: 'Open Music Queue' }).waitFor();
        assert.equal(await activity.getByRole('link', { name: /diagnostic/i }).count(), 0);
        assertNoNormalSurfaceDiagnostics(await activity.innerText());
        assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      }, { scenarioName: `music_queue_${scenario.key}_browser_acceptance` });
    });
  }

  for (const scenario of STOP_CASES) {
    test(`${scenario.key} stops with one release-scoped action and no candidate-first handoff`, {
      timeout: integrationRuntimeConfig.scenarioTimeoutMs,
    }, async (t) => {
      if (runtimeUnavailableReason) {
        t.skip(runtimeUnavailableReason);
        return;
      }

      await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
        const { pageErrors } = await bootstrapTerminalRecoveryScenario({
          baseUrl,
          browserContext,
          page,
          scenario,
        });

        await page.goto(`${baseUrl}/app/music-queue`, { waitUntil: 'domcontentloaded' });
        const releaseRow = getReleaseRow(page, scenario);
        const details = page.getByRole('complementary', { name: 'Music Queue details' });

        if (scenario.key === 'strict_quality_exhaustion') {
          await releaseRow.getByText('Quality choice needed', { exact: true }).waitFor();
          await releaseRow.getByRole('button', { name: 'Review quality choice' }).click();
          await details.getByRole('button', { name: 'Search again' }).waitFor();
          assert.equal(await releaseRow.getByRole('link', { name: 'Open Downloader' }).count(), 0);
          assert.equal(await releaseRow.getByRole('link', { name: 'Open Library' }).count(), 0);
        } else {
          await releaseRow.getByText('Needs help', { exact: true }).waitFor();
          await releaseRow.getByText('Existing library files need review', { exact: true }).waitFor();
          await releaseRow.getByRole('button', { name: 'Review library conflict' }).click();
          await details.getByRole('heading', { name: 'Existing library files need review' }).waitFor();
          await details.getByRole('link', { name: 'Advanced diagnostics' }).waitFor();
          assert.equal(await details.getByRole('button', { name: 'Search again' }).count(), 0);
          assert.equal(await releaseRow.getByRole('link', { name: 'Open Library' }).count(), 0);
        }

        assertNoNormalSurfaceDiagnostics(await page.getByRole('main').innerText());

        await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
        const activity = getActivityEntry(page, scenario);
        const activityLinkName = scenario.key === 'strict_quality_exhaustion'
          ? 'Review quality choice'
          : 'Review library conflict';
        await activity.getByRole('link', { name: activityLinkName }).waitFor();
        assert.equal(await activity.getByRole('link', { name: /diagnostic/i }).count(), 0);
        assertNoNormalSurfaceDiagnostics(await activity.innerText());

        await activity.getByRole('link', { name: activityLinkName }).click();
        await page.waitForFunction((releaseId) => globalThis.location.pathname === `/app/music-queue/${releaseId}`, scenario.id);
        const selectedReleaseRow = getReleaseRow(page, scenario);
        await selectedReleaseRow.getByText(scenario.initialStatus.label, { exact: true }).waitFor();
        assert.equal(await selectedReleaseRow.getByRole('button', { name: 'Review matches' }).count(), 0);
        assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      }, { scenarioName: `music_queue_${scenario.key}_browser_acceptance` });
    });
  }
});
