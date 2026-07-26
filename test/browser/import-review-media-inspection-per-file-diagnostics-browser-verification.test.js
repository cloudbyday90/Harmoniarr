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
  buildDiagnosticRunPanelRouteSuffix,
  buildImportReviewDiagnosticFixturePack,
  IMPORT_REVIEW_DIAGNOSTIC_FIXTURE,
} from '../../testing/browser/import-review-diagnostic-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function getRunwayPanel(page, headingName) {
  return page.locator('.review-panel').filter({
    has: page.getByRole('heading', { exact: true, name: headingName }),
  });
}

async function waitForHash(page, expectedHash) {
  await page.waitForFunction((hash) => globalThis.location.hash === hash, expectedHash);
}

async function openImportReviewForAdmin({
  baseUrl,
  browserContext,
  page,
  workspace,
  urlSuffix = '',
}) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  await seedMetadataImportReviewWorkspace(page, workspace);
  await page.goto(`${baseUrl}/app/activity/candidates${urlSuffix}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByText('Operator runway', { exact: true }).waitFor();
}

suite('Import Review media-inspection per-file diagnostics browser verification', () => {
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

  test('admins can inspect persisted per-file media inspection diagnostics from a selected run URL', {
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

      const workspace = buildImportReviewDiagnosticFixturePack();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix: buildDiagnosticRunPanelRouteSuffix(workspace),
      });

      await waitForHash(page, '#import-media-inspection-run-panel');
      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
      await mediaPanel.getByText('Media inspection completed with file diagnostics.', { exact: true }).waitFor();

      const diagnosticsTable = mediaPanel.getByRole('table', {
        name: 'Media inspection file diagnostics',
      });
      await diagnosticsTable.waitFor();
      await diagnosticsTable.getByText(IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFilename, { exact: true }).waitFor();
      await diagnosticsTable.getByText('Media Inspection Probe Failed', { exact: true }).waitFor();
      await diagnosticsTable.getByText('ffprobe could not read alpha.flac.', { exact: true }).waitFor();
      await diagnosticsTable.getByText(IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.secondaryDiagnosticFilename, { exact: true }).waitFor();
      await diagnosticsTable.getByText('Media Inspection No Audio Stream', { exact: true }).waitFor();
      await diagnosticsTable.getByText('No audio stream was detected in beta.flac.', { exact: true }).waitFor();
      assert.equal(await diagnosticsTable.getByText('diagnostic-peer', { exact: true }).count(), 2);
      assert.equal(
        await diagnosticsTable.getByText(IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.diagnosticFolderPath, { exact: true }).count(),
        2,
      );

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_media_inspection_per_file_diagnostics',
    });
  });
});
