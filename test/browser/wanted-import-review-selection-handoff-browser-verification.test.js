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
  readMetadataBrowserFixtureState,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { installWantedBrowserFixtures } from '../../testing/browser/wanted-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Wanted to Import Review selection handoff browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await browserRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('admins can open high-confidence wanted candidates, select one, and see Wanted update', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await installMetadataBrowserFixtures(browserContext);
      await installWantedBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/activity/wanted`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Wanted' }).waitFor();

      const wantedTable = page.getByRole('table', { name: 'Wanted releases' });
      const selectionRow = wantedTable.getByRole('row').filter({
        hasText: 'Selected Ambient Works 85-92',
      }).first();
      await selectionRow.getByText('Ready for selection', { exact: true }).waitFor();
      await selectionRow.getByText(
        'Best score 91 meets the 85 threshold. Select it in Import Review to start download handoff.',
        { exact: true },
      ).waitFor();

      await selectionRow.getByRole('link', { name: 'Open candidates' }).click();
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/activity/candidates'
          && url.searchParams.get('sourceSearchId') === 'search-selection-ready-saw'
          && url.searchParams.get('status') === 'all';
      });

      await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();
      await page.getByText('2 matching candidates', { exact: true }).waitFor();

      const highConfidenceCandidate = page.getByRole('button').filter({
        hasText: 'high-confidence-peer',
      }).first();
      await highConfidenceCandidate.click();
      await page.getByRole('heading', { exact: true, name: 'Files and actions' }).waitFor();
      await page.getByText('high-confidence-peer', { exact: true }).first().waitFor();

      const selectButton = page.getByRole('button', { exact: true, name: 'Select' });
      await selectButton.click();
      await page.getByRole('status').filter({ hasText: 'Candidate selected for download.' }).waitFor();
      await page.getByText('1 selected candidate ready for download.', { exact: true }).waitFor();

      const fixtureState = await readMetadataBrowserFixtureState(page);
      const selectedCandidate = fixtureState.importReviewCandidates.find(
        (candidate) => candidate.id === 'candidate-selection-ready',
      );
      assert.equal(selectedCandidate?.status, 'selected');

      await page.getByRole('link', { exact: true, name: 'Wanted' }).click();
      await page.waitForURL('**/app/activity/wanted');
      const refreshedWantedTable = page.getByRole('table', { name: 'Wanted releases' });
      const refreshedSelectionRow = refreshedWantedTable.getByRole('row').filter({
        hasText: 'Selected Ambient Works 85-92',
      }).first();
      await refreshedSelectionRow.getByText('Selected for download', { exact: true }).waitFor();
      await refreshedSelectionRow.getByText('1 candidate selected in Import Review.', {
        exact: true,
      }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'wanted_import_review_selection_handoff',
    });
  });
});
