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
  buildImportReviewMediaInspectionRun,
  buildImportReviewRunSummary,
} from '../../testing/browser/import-review-browser-helpers.js';
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
  await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();
  await page.getByText('Operator runway', { exact: true }).waitFor();
}

function buildMediaInspectionDiagnosticsWorkspace() {
  const currentRun = buildImportReviewMediaInspectionRun({
    id: 'media-inspection-run-current',
  });
  const diagnosticRun = buildImportReviewMediaInspectionRun({
    currentStep: 'Media inspection completed with file diagnostics.',
    id: 'media-inspection-run-diagnostics',
    inspectedCandidateCount: 1,
    inspectedFileCount: 2,
    inspectionDiagnostics: [{
      candidateId: 'candidate-diagnostics',
      code: 'media_inspection_probe_failed',
      fileId: 'candidate-diagnostics-file-1',
      filename: 'alpha.flac',
      folderPath: '/private/staging/Boards of Canada/Geogaddi',
      message: 'ffprobe could not read alpha.flac.',
      username: 'diagnostic-peer',
    }, {
      candidateId: 'candidate-diagnostics',
      code: 'media_inspection_no_audio_stream',
      fileId: 'candidate-diagnostics-file-2',
      filename: 'beta.flac',
      folderPath: '/private/staging/Boards of Canada/Geogaddi',
      message: 'No audio stream was detected in beta.flac.',
      username: 'diagnostic-peer',
    }],
    inspectionUnavailableCount: 1,
    status: 'completed',
    warningCount: 2,
  });

  return {
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun,
      recentRuns: [diagnosticRun, currentRun],
      summary: {
        message: 'Media inspection diagnostics are ready.',
      },
    }),
    run: diagnosticRun,
  };
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

      const workspace = buildMediaInspectionDiagnosticsWorkspace();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix: `?mediaInspectionRunId=${workspace.run.id}#import-media-inspection-run-panel`,
      });

      await waitForHash(page, '#import-media-inspection-run-panel');
      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
      await mediaPanel.getByText('Media inspection completed with file diagnostics.', { exact: true }).waitFor();

      const diagnosticsTable = mediaPanel.getByRole('table', {
        name: 'Media inspection file diagnostics',
      });
      await diagnosticsTable.waitFor();
      await diagnosticsTable.getByText('alpha.flac', { exact: true }).waitFor();
      await diagnosticsTable.getByText('Media Inspection Probe Failed', { exact: true }).waitFor();
      await diagnosticsTable.getByText('ffprobe could not read alpha.flac.', { exact: true }).waitFor();
      await diagnosticsTable.getByText('beta.flac', { exact: true }).waitFor();
      await diagnosticsTable.getByText('Media Inspection No Audio Stream', { exact: true }).waitFor();
      await diagnosticsTable.getByText('No audio stream was detected in beta.flac.', { exact: true }).waitFor();
      assert.equal(await diagnosticsTable.getByText('diagnostic-peer', { exact: true }).count(), 2);
      assert.equal(
        await diagnosticsTable.getByText('/private/staging/Boards of Canada/Geogaddi', { exact: true }).count(),
        2,
      );

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_media_inspection_per_file_diagnostics',
    });
  });
});
