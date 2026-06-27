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
  assertLocatorFocused,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
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

async function waitForMissingSearchParam(page, key) {
  await page.waitForFunction(
    (paramKey) => !new URL(globalThis.location.href).searchParams.has(paramKey),
    key,
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

function buildNormalCandidate() {
  const folderPath = '/private/staging/Aphex Twin/Selected Ambient Works';
  return buildImportReviewCandidate({
    fileCount: 1,
    files: [{
      bitRateKbps: 894,
      extension: 'flac',
      filename: 'xtal.flac',
      folderPath,
      id: 'candidate-normal-file-1',
      isLocked: false,
      lengthSeconds: 293,
      sizeBytes: 41779200,
    }],
    folderPath,
    id: 'candidate-normal',
    sourceSearchId: 'search-normal',
    status: 'pending',
    username: 'normal-peer',
  });
}

function buildDiagnosticRepairWorkspace() {
  const diagnosticCandidate = buildDiagnosticCandidate();
  const normalCandidate = buildNormalCandidate();
  const currentRun = buildImportReviewMediaInspectionRun({
    id: 'media-inspection-run-current',
  });
  const diagnosticRun = buildImportReviewMediaInspectionRun({
    currentStep: 'Media inspection completed with file diagnostics.',
    id: 'media-inspection-run-diagnostics',
    inspectedCandidateCount: 1,
    inspectedFileCount: 2,
    inspectionDiagnostics: [{
      candidateId: diagnosticCandidate.id,
      code: 'media_inspection_probe_failed',
      fileId: 'candidate-diagnostics-file-1',
      filename: 'alpha.flac',
      folderPath: diagnosticCandidate.folderPath,
      message: 'ffprobe could not read alpha.flac.',
      username: diagnosticCandidate.username,
    }],
    inspectionUnavailableCount: 1,
    status: 'completed',
    warningCount: 1,
  });

  return {
    candidates: [diagnosticCandidate, normalCandidate],
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun,
      recentRuns: [diagnosticRun, currentRun],
      summary: {
        message: 'Media inspection diagnostics are ready.',
      },
    }),
    previewById: {
      [diagnosticCandidate.id]: buildImportReviewPreview(diagnosticCandidate),
      [normalCandidate.id]: buildImportReviewPreview(normalCandidate),
    },
    run: diagnosticRun,
    diagnosticCandidate,
    normalCandidate,
  };
}

suite('Import Review diagnostic-driven repair-state browser verification', () => {
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

  test('admins can repair from a focused diagnostic file while preserving run state', {
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

      const workspace = buildDiagnosticRepairWorkspace();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix: `?mediaInspectionRunId=${workspace.run.id}#import-media-inspection-run-panel`,
      });

      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
      const diagnosticsTable = mediaPanel.getByRole('table', {
        name: 'Media inspection file diagnostics',
      });
      await diagnosticsTable
        .locator('tbody tr')
        .filter({ hasText: 'alpha.flac' })
        .getByRole('button', { name: 'Open alpha.flac in candidate detail' })
        .click();

      await waitForHash(page, `#${IMPORT_REVIEW_SELECTION_STAGE_ID}`);
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', 'candidate-diagnostics-file-1');
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const focusedFile = page.locator('[data-import-candidate-file-id="candidate-diagnostics-file-1"]');
      await focusedFile.waitFor();
      await assertLocatorFocused(focusedFile, 'Diagnostic file should receive focus before repair');

      const reopenButton = page.getByRole('button', { name: 'Reopen' });
      await reopenButton.focus();
      await reopenButton.press('Enter');

      const actionStatus = page.getByRole('status').filter({
        hasText: 'Candidate reopened for review.',
      });
      await actionStatus.waitFor();
      await assertLocatorFocused(actionStatus, 'Successful diagnostic repair should focus the status message');
      await assertVisibleFocusOutline(actionStatus, 'Successful diagnostic repair status should have a visible focus ring');
      await page.getByText('Pending', { exact: true }).first().waitFor();
      await page.getByRole('button', { exact: true, name: 'Hold' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Select' }).waitFor();
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', 'candidate-diagnostics-file-1');
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const selectedRunRow = mediaPanel.locator('tbody tr').filter({ hasText: workspace.run.id });
      await selectedRunRow.getByRole('button', { name: 'Selected' }).waitFor();
      assert.equal(await selectedRunRow.getAttribute('aria-selected'), 'true');

      await page
        .locator('.review-list-item')
        .filter({ hasText: workspace.normalCandidate.folderPath })
        .click();
      await waitForSearchParam(page, 'candidate', workspace.normalCandidate.id);
      await waitForMissingSearchParam(page, 'candidateFile');
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);
      await page
        .locator(`#${IMPORT_REVIEW_SELECTION_STAGE_ID}`)
        .getByRole('heading', { exact: true, name: workspace.normalCandidate.folderPath })
        .waitFor();
      assert.equal(await page.locator('[data-focused="true"]').count(), 0);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_diagnostic_repair_state',
    });
  });
});
