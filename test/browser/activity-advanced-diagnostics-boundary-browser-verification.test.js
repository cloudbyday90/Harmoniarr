/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  installMetadataBrowserFixtures,
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  buildImportReviewCandidate,
  buildImportReviewPreview,
} from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Activity advanced diagnostics boundary browser verification', () => {
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

  test('keeps match and library-add controls behind the disclosure while preserving legacy drill-down URLs', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      const legacyCandidate = buildImportReviewCandidate({ id: 'legacy-candidate' });
      await seedMetadataImportReviewWorkspace(page, {
        candidates: [legacyCandidate],
        previewById: {
          [legacyCandidate.id]: buildImportReviewPreview(legacyCandidate),
        },
      });

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      const diagnostics = page.locator('details.activity-diagnostics');
      await diagnostics.waitFor();
      assert.equal(await diagnostics.evaluate((element) => element.open), false);

      await diagnostics.getByText('Advanced diagnostics', { exact: true }).click();
      await diagnostics.getByRole('heading', { name: 'Diagnostic tasks', exact: true }).waitFor();
      await diagnostics.getByRole('heading', { name: 'Resolve an issue', exact: true }).waitFor();
      await diagnostics.getByText('Start here when background work is stalled, paused, or could not add music.').waitFor();
      await diagnostics.getByRole('link', { name: 'Background jobs' }).waitFor();
      await diagnostics.getByRole('link', { name: 'Failed library adds' }).waitFor();
      await diagnostics.getByRole('heading', { name: 'Inspect music', exact: true }).waitFor();
      await diagnostics.getByRole('link', { name: 'Match diagnostics' }).waitFor();
      await diagnostics.getByRole('link', { name: 'Library-add diagnostics' }).waitFor();
      assert.equal(await diagnostics.locator('.activity-diagnostic-group').count(), 4);
      assert.equal(await diagnostics.getByText(/candidate(?:s)?/i).count(), 0);

      const timelineOrder = await page.locator('.activity-workspace').evaluate((workspace) => [
        ...workspace.children,
      ].filter((child) => child.classList.contains('activity-workspace-content') || child.matches('details'))
        .map((child) => child.classList.contains('activity-workspace-content') ? 'content' : 'diagnostics'));
      assert.deepEqual(timelineOrder, ['content', 'diagnostics']);

      await page.setViewportSize({ height: 844, width: 390 });
      const mobileDiagnostics = await diagnostics.evaluate((element) => ({
        minimumLinkHeight: Math.min(...[...element.querySelectorAll('.activity-diagnostic-group a')]
          .map((link) => link.getBoundingClientRect().height)),
        scrollWidth: globalThis.document.documentElement.scrollWidth,
        viewportWidth: globalThis.innerWidth,
      }));
      assert.ok(mobileDiagnostics.minimumLinkHeight >= 44, 'Diagnostic links should keep a usable mobile target.');
      assert.ok(mobileDiagnostics.scrollWidth <= mobileDiagnostics.viewportWidth, 'Diagnostic groups should not overflow mobile width.');

      await diagnostics.getByRole('link', { name: 'Match diagnostics' }).click();
      await page.waitForFunction(() => globalThis.location.pathname === '/app/activity/diagnostics/matches');
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      assert.equal(
        await page.getByRole('link', { name: 'Activity timeline' }).getAttribute('href'),
        '/app/activity/feed',
      );
      assert.equal(await diagnostics.evaluate((element) => element.open), false);
      const directDiagnosticOrder = await page.locator('.activity-workspace').evaluate((workspace) => [
        ...workspace.children,
      ].filter((child) => child.classList.contains('activity-workspace-content') || child.matches('details'))
        .map((child) => child.classList.contains('activity-workspace-content') ? 'content' : 'diagnostics'));
      assert.deepEqual(directDiagnosticOrder, ['diagnostics', 'content']);

      await page.getByRole('link', { name: 'Activity timeline' }).click();
      await page.waitForFunction(() => globalThis.location.pathname === '/app/activity/feed');
      await page.getByRole('heading', { exact: true, name: 'Activity timeline' }).waitFor();

      await page.goto(`${baseUrl}/app/activity/candidates?candidate=legacy-candidate#import-review-selection-stage`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/activity/diagnostics/matches'
          && url.searchParams.get('candidate') === 'legacy-candidate'
          && url.hash === '#import-review-selection-stage';
      });
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();

      await page.goto(`${baseUrl}/app/activity/diagnostics?candidate=legacy-candidate#import-review-selection-stage`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/activity/diagnostics/matches'
          && url.searchParams.get('candidate') === 'legacy-candidate'
          && url.hash === '#import-review-selection-stage';
      });

      await page.goto(`${baseUrl}/app/activity/queue?artist=legacy-artist#music-queue-release-list`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/missing'
          && url.searchParams.get('artist') === 'legacy-artist'
          && url.hash === '#music-queue-release-list';
      });
      await page.getByRole('heading', { exact: true, name: 'Missing Music' }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, { scenarioName: 'activity_advanced_diagnostics_boundary' });
  });
});
