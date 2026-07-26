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
  buildEmptyDownloaderQueueFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import {
  buildImportReviewCandidate,
  buildImportReviewExecutionRun,
  buildImportReviewPreview,
  buildImportReviewRunSummary,
} from '../../testing/browser/import-review-browser-helpers.js';
import {
  installMetadataBrowserFixtures,
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function buildLinkedTransferWorkspace() {
  const candidate = buildImportReviewCandidate({
    fileCount: 1,
    files: [{
      bitRateKbps: 921,
      extension: 'flac',
      filename: '01 Foil.flac',
      folderPath: '/private/staging/Autechre/Amber',
      id: 'candidate-downloader-linked-file-1',
      isLocked: false,
      lengthSeconds: 397,
      sizeBytes: 54316224,
    }],
    folderPath: '/private/staging/Autechre/Amber',
    id: 'candidate-downloader-linked',
    lockedFileCount: 0,
    sourceSearchId: 'search-discovery-dispatch-amber',
    status: 'downloading',
    totalSizeBytes: 54316224,
    username: 'healthy-slskd-peer',
  });
  const executionRun = buildImportReviewExecutionRun({
    currentStep: 'Download transfer state synced from slskd.',
    id: 'import-execution-run-downloader-linked',
    items: [{
      id: 'execution-item-downloader-linked',
      itemStatus: 'queued',
      liveTransferSummary: {
        active: 1,
        bytesTransferred: 44040192,
        completed: 0,
        failed: 0,
        message: '1 transfer is actively progressing.',
        percentComplete: 42,
        queued: 0,
        rejected: 0,
        status: 'active',
        total: 1,
        totalBytes: 104857600,
      },
      liveTransfers: [{
        bytesTransferred: 44040192,
        filename: 'Autechre\\Amber\\01 Foil.flac',
        id: 'transfer-downloader-linked',
        placeInQueue: 0,
        size: 104857600,
        state: 'InProgress',
        username: 'healthy-slskd-peer',
      }],
      planningSnapshot: {
        candidate: {
          folderPath: candidate.folderPath,
          id: candidate.id,
          username: candidate.username,
        },
        planning: {
          libraryFolderPath: 'Music/Autechre/Amber',
          sourceFolderPath: '/private/staging/Autechre/Amber',
          stagingFolderPath: '/data/staging/candidate-downloader-linked',
        },
      },
      statusMessage: 'Queued in Downloader and actively progressing.',
      updatedAt: '2026-06-27T21:20:00.000Z',
    }],
    processedCandidateCount: 1,
    queuedCount: 1,
    requestedCandidateCount: 1,
    status: 'running',
    transferSnapshotUnavailable: false,
  });

  return {
    candidate,
    executionRun,
    workspace: {
      candidates: [candidate],
      executionSummary: buildImportReviewRunSummary({
        currentRun: executionRun,
        summary: {
          message: 'Download transfer state synced from slskd.',
          missingTransferPolicy: {
            gracePeriodLabel: '10 minutes',
          },
          status: 'running',
        },
      }),
      previewById: {
        [candidate.id]: buildImportReviewPreview(candidate),
      },
    },
  };
}

function buildCompletedTransferWorkspace() {
  const { candidate, executionRun, workspace } = buildLinkedTransferWorkspace();
  const completedRun = {
    ...executionRun,
    currentStep: 'Download transfer completed in slskd.',
    finishedAt: '2026-06-27T21:35:00.000Z',
    items: executionRun.items.map((item) => ({
      ...item,
      itemStatus: 'queued',
      liveTransferSummary: {
        active: 0,
        bytesTransferred: 104857600,
        completed: 1,
        failed: 0,
        message: '1 transfer completed.',
        percentComplete: 100,
        queued: 0,
        rejected: 0,
        status: 'completed',
        total: 1,
        totalBytes: 104857600,
      },
      liveTransfers: [],
      statusMessage: 'Queued in Downloader and completed.',
    })),
    status: 'completed',
  };

  return {
    candidate,
    executionRun: completedRun,
    workspace: {
      ...workspace,
      executionSummary: buildImportReviewRunSummary({
        currentRun: completedRun,
        summary: {
          message: 'Download transfer completed in slskd.',
          missingTransferPolicy: {
            gracePeriodLabel: '10 minutes',
          },
          status: 'completed',
        },
      }),
    },
  };
}

function getRunwayPanel(page, headingName) {
  return page.locator('.review-panel').filter({
    has: page.getByRole('heading', { exact: true, name: headingName }),
  });
}

async function assertDownloaderDetailsOpen(page) {
  await page.waitForFunction(() => {
    const url = new URL(globalThis.location.href);
    return url.pathname === '/app/downloader'
      && url.searchParams.get('open') === 'details'
      && url.searchParams.get('transferId') === 'transfer-downloader-linked'
      && url.searchParams.get('username') === 'healthy-slskd-peer';
  });
  const dialog = page.getByRole('dialog', { name: /01 Foil\.flac/u });
  await dialog.waitFor();
  await dialog.getByText('Linked to Import Review candidate.', { exact: true }).waitFor();
}

suite('Import Review Downloader transfer handoff browser verification', () => {
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

  test('admins can open a live Import Review execution transfer in Downloader', {
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

      const { executionRun, workspace } = buildLinkedTransferWorkspace();
      await installMetadataBrowserFixtures(browserContext);
      await installDownloaderBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedMetadataImportReviewWorkspace(page, workspace);

      await page.goto(
        `${baseUrl}/app/activity/candidates?executionRunId=${executionRun.id}#import-execution-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      const executionPanel = getRunwayPanel(page, 'Queue selected for download');
      await executionPanel.getByText(`Run ${executionRun.id}`, { exact: true }).waitFor();
      await executionPanel.getByText('Autechre\\Amber\\01 Foil.flac', { exact: true }).waitFor();
      await executionPanel.getByText('1 transfer is actively progressing.', { exact: true }).waitFor();

      await executionPanel.getByRole('link', { name: 'Open in Downloader' }).click();
      await assertDownloaderDetailsOpen(page);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_downloader_transfer_handoff',
    });
  });

  test('admins see completed transfer sync evidence when the live Downloader row is gone', {
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

      const { executionRun, workspace } = buildCompletedTransferWorkspace();
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedMetadataImportReviewWorkspace(page, workspace);

      await page.goto(
        `${baseUrl}/app/activity/candidates?executionRunId=${executionRun.id}#import-execution-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      const executionPanel = getRunwayPanel(page, 'Queue selected for download');
      await executionPanel.getByText(`Run ${executionRun.id}`, { exact: true }).waitFor();
      await executionPanel.getByText('1 transfer completed.', { exact: true }).waitFor();
      await executionPanel.getByText('Transfer completed in Downloader', { exact: true }).waitFor();
      await executionPanel.getByText('The live queue no longer has a row to open because the last sync recorded this transfer as complete.', { exact: true }).waitFor();
      assert.equal(await executionPanel.getByRole('link', { name: 'Open in Downloader' }).count(), 0);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_completed_transfer_sync_notice',
    });
  });

  test('admins see a clear notice when a direct Downloader transfer link is stale', {
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

      await installDownloaderBrowserFixtures(browserContext, {
        queue: buildEmptyDownloaderQueueFixture(),
      });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(
        `${baseUrl}/app/downloader?open=details&transferId=missing-transfer&username=stale-peer`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.getByRole('heading', { exact: true, name: 'Downloader' }).waitFor();
      await page.getByText('Transfer is no longer visible in Downloader', { exact: true }).waitFor();
      await page.getByText('The linked transfer is not in the current Downloader queue.', { exact: false }).waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);

      await page.getByRole('button', { name: 'Clear link' }).click();
      await page.waitForFunction(() => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/downloader'
          && !url.searchParams.has('open')
          && !url.searchParams.has('transferId')
          && !url.searchParams.has('username');
      });

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'downloader_stale_transfer_handoff_notice',
    });
  });
});
