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
  buildImportReviewMediaInspectionRun,
  buildImportReviewPreview,
  buildImportReviewRunSummary,
} from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const IMPORT_REVIEW_SELECTION_STAGE_ID = 'import-review-selection-stage';

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

async function waitForSearchParam(page, key, expectedValue) {
  await page.waitForFunction(
    ([paramKey, paramValue]) => new URL(globalThis.location.href).searchParams.get(paramKey) === paramValue,
    [key, expectedValue],
  );
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

function buildDiagnosticCandidate() {
  const folderPath = '/private/staging/Boards of Canada/Geogaddi';
  return buildImportReviewCandidate({
    fileCount: 2,
    files: [
      {
        bitRateKbps: 921,
        extension: 'flac',
        filename: 'alpha.flac',
        folderPath,
        id: 'candidate-diagnostics-file-1',
        isLocked: false,
        lengthSeconds: 301,
        sizeBytes: 52428800,
      },
      {
        bitRateKbps: 844,
        extension: 'flac',
        filename: 'beta.flac',
        folderPath,
        id: 'candidate-diagnostics-file-2',
        isLocked: false,
        lengthSeconds: 284,
        sizeBytes: 49283072,
      },
    ],
    folderPath,
    id: 'candidate-diagnostics',
    lockedFileCount: 0,
    normalizedPayload: {
      extensions: ['flac'],
    },
    sourceSearchId: 'search-diagnostics',
    status: 'selected',
    totalSizeBytes: 101711872,
    username: 'diagnostic-peer',
  });
}

function buildDiagnosticHandoffWorkspace() {
  const candidate = buildDiagnosticCandidate();
  const currentRun = buildImportReviewMediaInspectionRun({
    id: 'media-inspection-run-current',
  });
  const diagnosticRun = buildImportReviewMediaInspectionRun({
    currentStep: 'Media inspection completed with file diagnostics.',
    id: 'media-inspection-run-diagnostics',
    inspectedCandidateCount: 1,
    inspectedFileCount: 2,
    inspectionDiagnostics: [{
      candidateId: candidate.id,
      code: 'media_inspection_probe_failed',
      fileId: 'candidate-diagnostics-file-1',
      filename: 'alpha.flac',
      folderPath: candidate.folderPath,
      message: 'ffprobe could not read alpha.flac.',
      username: candidate.username,
    }, {
      candidateId: candidate.id,
      code: 'media_inspection_no_audio_stream',
      fileId: 'candidate-diagnostics-file-2',
      filename: 'beta.flac',
      folderPath: candidate.folderPath,
      message: 'No audio stream was detected in beta.flac.',
      username: candidate.username,
    }],
    inspectionUnavailableCount: 1,
    status: 'completed',
    warningCount: 2,
  });

  return {
    candidates: [candidate],
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun,
      recentRuns: [diagnosticRun, currentRun],
      summary: {
        message: 'Media inspection diagnostics are ready.',
      },
    }),
    previewById: {
      [candidate.id]: buildImportReviewPreview(candidate),
    },
    run: diagnosticRun,
    candidate,
  };
}

suite('Import Review diagnostic row handoff browser verification', () => {
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

  test('admins can open the diagnostic candidate without losing selected-run context', {
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

      const workspace = buildDiagnosticHandoffWorkspace();
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

      const diagnosticsTable = mediaPanel.getByRole('table', {
        name: 'Media inspection file diagnostics',
      });
      const alphaRow = diagnosticsTable.locator('tbody tr').filter({ hasText: 'alpha.flac' });
      await alphaRow.getByRole('button', { name: 'Open alpha.flac in candidate detail' }).click();

      await waitForHash(page, `#${IMPORT_REVIEW_SELECTION_STAGE_ID}`);
      await waitForSearchParam(page, 'candidate', workspace.candidate.id);
      await waitForSearchParam(page, 'candidateFile', 'candidate-diagnostics-file-1');
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const selectionStage = page.locator(`#${IMPORT_REVIEW_SELECTION_STAGE_ID}`);
      await selectionStage.getByRole('heading', { exact: true, name: 'Files and actions' }).waitFor();
      await selectionStage.getByRole('heading', { exact: true, name: workspace.candidate.folderPath }).waitFor();
      await selectionStage.getByText(workspace.candidate.username, { exact: true }).waitFor();
      await selectionStage.getByText('alpha.flac', { exact: true }).waitFor();
      await selectionStage.getByRole('button', { name: 'Reopen' }).waitFor();
      const focusedFile = selectionStage.locator('[data-import-candidate-file-id="candidate-diagnostics-file-1"]');
      await focusedFile.waitFor();
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
      assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.getAttribute('data-import-candidate-file-id')),
        'candidate-diagnostics-file-1',
      );

      const selectedRow = mediaPanel.locator('tbody tr').filter({ hasText: workspace.run.id });
      await selectedRow.getByRole('button', { name: 'Selected' }).waitFor();
      assert.equal(await selectedRow.getAttribute('aria-selected'), 'true');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_diagnostic_row_handoff',
    });
  });
});
