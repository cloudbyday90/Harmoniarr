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
  buildImportReviewApplyRun,
  buildImportReviewExecutionRun,
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

function buildFailedExecutionItem() {
  return {
    id: 'execution-item-failed-transfer',
    itemStatus: 'queue_failed',
    liveTransferSummary: {
      active: 0,
      completed: 0,
      failed: 1,
      message: 'Transfer disappeared from slskd after queueing.',
      missingTransfer: {
        graceDeadlineAt: '2026-06-24T19:15:00.000Z',
        isPastGracePeriod: true,
        lastCheckedAt: '2026-06-24T19:20:00.000Z',
        missingSince: '2026-06-24T19:00:00.000Z',
      },
      percentComplete: 12,
      status: 'not_found',
      total: 1,
    },
    liveTransfers: [
      {
        bytesTransferred: 12582912,
        exception: 'Remote transfer failed before completion.',
        filename: 'failed-track.flac',
        id: 'transfer-failed-track',
        size: 104857600,
        state: 'Completed, Errored',
        username: 'diagnostic-peer',
      },
    ],
    persistedMissingTransfer: {
      graceDeadlineAt: '2026-06-24T19:15:00.000Z',
      isPastGracePeriod: true,
      lastCheckedAt: '2026-06-24T19:20:00.000Z',
      message: 'Transfer has been missing past the grace period.',
      missingSince: '2026-06-24T19:00:00.000Z',
    },
    persistedTransferObservation: {
      lastReconciledAt: '2026-06-24T19:10:00.000Z',
      summary: {
        completed: 0,
        failed: 1,
        message: 'Previous sync recorded one failed transfer.',
        percentComplete: 12,
        status: 'failed',
        total: 1,
      },
      transfers: [],
    },
    planningSnapshot: {
      candidate: {
        folderPath: '/private/staging/Boards of Canada/Geogaddi',
        username: 'diagnostic-peer',
      },
      execution: {
        enqueuedTransfers: [
          {
            id: 'transfer-failed-track',
            username: 'diagnostic-peer',
          },
        ],
      },
      planning: {
        libraryFolderPath: 'household/listener/Boards of Canada/Geogaddi',
        sourceFolderPath: '/downloads/complete/Boards of Canada/Geogaddi',
        stagingFolderPath: '/data/staging/candidate-failed-transfer',
      },
    },
    statusMessage: 'Download queue failed after the remote transfer disappeared.',
  };
}

function buildFailedApplyItem() {
  return {
    applySnapshot: {
      apply: {
        result: {
          appliedFileCount: 0,
          failedFileCount: 1,
          notAttemptedCount: 1,
          stagedFromSourceCount: 0,
        },
      },
      candidate: {
        folderPath: '/private/staging/Boards of Canada/Geogaddi',
        username: 'diagnostic-peer',
      },
      fileOperations: [
        {
          errorMessage: 'Library move failed because the target file already exists.',
          filename: 'failed-track.flac',
          finishedAt: '2026-06-24T20:03:00.000Z',
          id: 'apply-operation-stage-failed',
          libraryPath: 'household/listener/Boards of Canada/Geogaddi/failed-track.flac',
          position: 1,
          sourcePath: '/downloads/complete/Boards of Canada/Geogaddi/failed-track.flac',
          stagingPath: '/data/staging/candidate-failed-apply/failed-track.flac',
          startedAt: '2026-06-24T20:02:00.000Z',
          status: 'failed',
          stepType: 'stage',
          transport: 'move',
        },
        {
          filename: 'skipped-track.flac',
          id: 'apply-operation-finalize-skipped',
          libraryPath: 'household/listener/Boards of Canada/Geogaddi/skipped-track.flac',
          position: 2,
          sourcePath: '/downloads/complete/Boards of Canada/Geogaddi/skipped-track.flac',
          stagingPath: '/data/staging/candidate-failed-apply/skipped-track.flac',
          status: 'not_attempted',
          stepType: 'finalize',
          transport: 'move',
        },
      ],
      planning: {
        libraryFolderPath: 'household/listener/Boards of Canada/Geogaddi',
        sourceFolderPath: '/downloads/complete/Boards of Canada/Geogaddi',
        stagingFolderPath: '/data/staging/candidate-failed-apply',
      },
    },
    id: 'apply-item-failed-operation',
    itemStatus: 'apply_failed',
    statusMessage: 'Import apply stopped before committing all files.',
  };
}

function buildFailureDiagnosticsWorkspace() {
  const mediaCurrent = buildImportReviewMediaInspectionRun({
    id: 'media-inspection-run-current',
  });
  const mediaFailed = buildImportReviewMediaInspectionRun({
    blockedCandidateCount: 1,
    currentStep: 'Media inspection failed while probing candidate files.',
    errorMessage: 'ffprobe is unavailable in the worker runtime.',
    id: 'media-inspection-run-failed',
    inspectedCandidateCount: 1,
    inspectedFileCount: 3,
    inspectionUnavailableCount: 2,
    status: 'failed',
    warningCount: 2,
  });

  const executionCurrent = buildImportReviewExecutionRun({
    id: 'execution-run-current',
  });
  const executionFailed = buildImportReviewExecutionRun({
    currentStep: 'Download execution failed while reconciling transfers.',
    errorMessage: 'slskd transfer snapshot could not be loaded.',
    id: 'execution-run-failed',
    items: [buildFailedExecutionItem()],
    queueFailedCount: 1,
    queuedCount: 0,
    status: 'failed',
    transferSnapshotUnavailable: true,
  });

  const applyCurrent = buildImportReviewApplyRun({
    id: 'apply-run-current',
  });
  const applyFailed = buildImportReviewApplyRun({
    appliedCount: 0,
    applyFailedCount: 1,
    currentStep: 'Import apply failed during file operations.',
    errorMessage: 'Library move failed and rollback completed.',
    id: 'apply-run-failed',
    items: [buildFailedApplyItem()],
    status: 'failed',
  });

  return {
    applySummary: buildImportReviewRunSummary({
      currentRun: applyCurrent,
      recentRuns: [applyFailed, applyCurrent],
      summary: {
        message: 'Import apply diagnostics are ready.',
      },
    }),
    executionSummary: buildImportReviewRunSummary({
      currentRun: executionCurrent,
      recentRuns: [executionFailed, executionCurrent],
      summary: {
        heartbeat: {
          intervalLabel: 'Manual fixture',
          source: 'browser fixture',
          state: {
            lastOutcome: 'error',
            lastSkipReason: 'error',
            lastTickAt: '2026-06-24T19:20:00.000Z',
            lastTransitionCount: 0,
          },
        },
        message: 'Download execution diagnostics are ready.',
        missingTransferPolicy: {
          gracePeriodLabel: '15 minutes',
        },
      },
    }),
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun: mediaCurrent,
      recentRuns: [mediaFailed, mediaCurrent],
      summary: {
        message: 'Media inspection diagnostics are ready.',
      },
    }),
    runs: {
      applyFailed,
      executionFailed,
      mediaFailed,
    },
  };
}

suite('Import Review run-detail failure diagnostics browser verification', () => {
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

  test('admins can deep-link to failed run diagnostics across runway panels', {
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

      const workspace = buildFailureDiagnosticsWorkspace();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix: `?mediaInspectionRunId=${workspace.runs.mediaFailed.id}#import-media-inspection-run-panel`,
      });

      await waitForHash(page, '#import-media-inspection-run-panel');
      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.runs.mediaFailed.id}`, { exact: true }).waitFor();
      await mediaPanel.getByText('Media inspection failed while probing candidate files.', { exact: true }).waitFor();
      await mediaPanel.getByRole('status').filter({
        hasText: 'ffprobe is unavailable in the worker runtime.',
      }).waitFor();
      await mediaPanel.getByText('Inspection unavailable', { exact: true }).waitFor();
      await mediaPanel.getByText('Blocked candidates', { exact: true }).waitFor();

      await page.goto(
        `${baseUrl}/app/activity/candidates?executionRunId=${workspace.runs.executionFailed.id}#import-execution-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await waitForHash(page, '#import-execution-run-panel');
      const executionPanel = getRunwayPanel(page, 'Queue selected for download');
      await executionPanel.getByText(`Run ${workspace.runs.executionFailed.id}`, { exact: true }).waitFor();
      await executionPanel.getByRole('status').filter({
        hasText: 'slskd transfer snapshot could not be loaded.',
      }).waitFor();
      await executionPanel.getByRole('status').filter({
        hasText: 'Live transfer data is temporarily unavailable.',
      }).waitFor();
      await executionPanel.getByText('Download queue failed after the remote transfer disappeared.', {
        exact: true,
      }).waitFor();
      await executionPanel.locator('.review-status-pill').filter({
        hasText: 'Queue failed',
      }).waitFor();
      await executionPanel.getByText('Transfer disappeared from slskd after queueing.', { exact: true }).waitFor();
      await executionPanel.getByText('Remote transfer failed before completion.', { exact: true }).waitFor();
      await executionPanel.getByText('Previous sync recorded one failed transfer.', { exact: true }).waitFor();

      await page.goto(
        `${baseUrl}/app/activity/candidates?applyRunId=${workspace.runs.applyFailed.id}#import-apply-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await waitForHash(page, '#import-apply-run-panel');
      const applyPanel = getRunwayPanel(page, 'Move downloads to library');
      await applyPanel.getByText(`Run ${workspace.runs.applyFailed.id}`, { exact: true }).waitFor();
      await applyPanel.getByRole('status').filter({
        hasText: 'Library move failed and rollback completed.',
      }).waitFor();
      await applyPanel.getByText('Import apply stopped before committing all files.', {
        exact: true,
      }).waitFor();
      await applyPanel.locator('.review-status-pill').filter({
        hasText: 'Apply failed',
      }).waitFor();
      await applyPanel.getByText('failed-track.flac', { exact: true }).waitFor();
      await applyPanel.getByText('Library move failed because the target file already exists.', {
        exact: true,
      }).waitFor();
      await applyPanel.locator('.review-status-pill').filter({
        hasText: 'Not attempted',
      }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_failed_run_diagnostics_deep_links',
    });
  });
});
