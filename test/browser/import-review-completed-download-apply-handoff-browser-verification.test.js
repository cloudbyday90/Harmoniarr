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
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { installLibraryBrowserFixtures } from '../../testing/browser/library-browser-fixtures.js';
import {
  buildImportReviewApplyRun,
  buildImportReviewCandidate,
  buildImportReviewExecutionRun,
  buildImportReviewPreview,
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

function buildCompletedDownloadApplyWorkspace() {
  const candidate = buildImportReviewCandidate({
    folderPath: '/private/staging/Autechre/Amber',
    id: 'candidate-completed-download-ready',
    importPendingAt: '2026-06-27T21:36:00.000Z',
    importStatus: {
      code: 'ready',
      message: 'Completed download is ready to import.',
    },
    planning: {
      libraryFolderPath: 'Music/Autechre/Amber',
      resolutionStrategy: 'mapped',
      sourceFolderPath: '/private/staging/Autechre/Amber',
      stagingFolderPath: '/data/staging/candidate-completed-download-ready',
    },
    status: 'import_pending',
    username: 'healthy-slskd-peer',
  });
  const executionRun = buildImportReviewExecutionRun({
    currentStep: 'Download transfer completed in slskd.',
    finishedAt: '2026-06-27T21:35:00.000Z',
    id: 'import-execution-run-completed-download',
    items: [{
      id: 'execution-item-completed-download',
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
      planningSnapshot: {
        candidate: {
          folderPath: candidate.folderPath,
          id: candidate.id,
          username: candidate.username,
        },
        planning: {
          libraryFolderPath: 'Music/Autechre/Amber',
          sourceFolderPath: '/private/staging/Autechre/Amber',
          stagingFolderPath: '/data/staging/candidate-completed-download-ready',
        },
      },
      statusMessage: 'Queued in Downloader and completed.',
      updatedAt: '2026-06-27T21:36:00.000Z',
    }],
    processedCandidateCount: 1,
    queuedCount: 1,
    requestedCandidateCount: 1,
    status: 'completed',
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
          message: 'Download transfer completed in slskd.',
          missingTransferPolicy: {
            gracePeriodLabel: '10 minutes',
          },
          status: 'completed',
        },
      }),
      previewById: {
        [candidate.id]: buildImportReviewPreview(candidate),
      },
    },
  };
}

function buildCompletedImportApplyWorkspace() {
  const candidate = buildImportReviewCandidate({
    folderPath: '/private/staging/Boards of Canada/Tomorrow\'s Harvest',
    id: 'candidate-applied-tomorrows-harvest',
    importPendingAt: '2026-06-27T21:36:00.000Z',
    importStatus: {
      code: 'applied',
      message: 'Imported release is available in Library.',
    },
    planning: {
      libraryFolderPath: 'Music/Boards of Canada/Tomorrow\'s Harvest',
      resolutionStrategy: 'mapped',
      sourceFolderPath: '/private/staging/Boards of Canada/Tomorrow\'s Harvest',
      stagingFolderPath: '/data/staging/candidate-applied-tomorrows-harvest',
    },
    status: 'applied',
    username: 'healthy-slskd-peer',
  });
  const applyRun = buildImportReviewApplyRun({
    currentStep: 'Import apply completed.',
    finishedAt: '2026-06-27T22:05:00.000Z',
    id: 'apply-run-tomorrows-harvest-completed',
    items: [{
      applySnapshot: {
        apply: {
          result: {
            appliedFileCount: 17,
            failedFileCount: 0,
            notAttemptedCount: 0,
            stagedFromSourceCount: 17,
          },
        },
        candidate: {
          folderPath: candidate.folderPath,
          id: candidate.id,
          username: candidate.username,
        },
        fileOperations: [{
          appliedMode: 'move',
          filename: '01 - Gemini.flac',
          finishedAt: '2026-06-27T22:05:00.000Z',
          id: 'apply-operation-gemini-finalize',
          libraryPath: 'Music/Boards of Canada/Tomorrow\'s Harvest/01 - Gemini.flac',
          position: 1,
          sourcePath: '/private/staging/Boards of Canada/Tomorrow\'s Harvest/01 - Gemini.flac',
          stagingPath: '/data/staging/candidate-applied-tomorrows-harvest/01 - Gemini.flac',
          startedAt: '2026-06-27T22:04:00.000Z',
          status: 'applied',
          stepType: 'finalize',
          transport: 'filesystem',
        }],
        planning: {
          libraryFolderPath: 'Music/Boards of Canada/Tomorrow\'s Harvest',
          sourceFolderPath: '/private/staging/Boards of Canada/Tomorrow\'s Harvest',
          stagingFolderPath: '/data/staging/candidate-applied-tomorrows-harvest',
        },
      },
      id: 'apply-item-tomorrows-harvest',
      itemStatus: 'applied',
      statusMessage: 'Import apply completed and the release is available in Library.',
      updatedAt: '2026-06-27T22:05:00.000Z',
    }],
    processedCandidateCount: 1,
    requestedCandidateCount: 1,
    status: 'completed',
  });

  return {
    applyRun,
    candidate,
    workspace: {
      applySummary: buildImportReviewRunSummary({
        currentRun: applyRun,
        summary: {
          message: 'Import apply completed.',
          status: 'completed',
        },
      }),
      candidates: [candidate],
      previewById: {
        [candidate.id]: buildImportReviewPreview(candidate),
      },
    },
  };
}

suite('Import Review completed-download apply handoff browser verification', () => {
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

  test('admins can move from completed transfer evidence to import apply readiness', {
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

      const { candidate, executionRun, workspace } = buildCompletedDownloadApplyWorkspace();
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedMetadataImportReviewWorkspace(page, workspace);

      await page.goto(
        `${baseUrl}/app/activity/candidates?candidate=${candidate.id}&status=import_pending&executionRunId=${executionRun.id}#import-execution-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();

      const executionPanel = getRunwayPanel(page, 'Queue selected for download');
      await executionPanel.getByText('1 transfer completed.', { exact: true }).waitFor();
      await executionPanel.getByText('Transfer completed in Downloader', { exact: true }).waitFor();

      await page.getByText('1 candidate waiting for import.', { exact: true }).waitFor();
      await page.getByText('Completed download is ready to import.', { exact: true }).waitFor();

      const applyPanel = getRunwayPanel(page, 'Move downloads to library');
      await applyPanel.getByText('1 download is ready to import', { exact: true }).waitFor();
      await applyPanel.getByText(
        'Start import apply to stage and commit this completed download into the library.',
        { exact: true },
      ).waitFor();
      const applyStart = applyPanel.getByRole('button', { name: 'Start import apply' });
      assert.equal(await applyStart.isEnabled(), true);

      await applyStart.click();
      const applyDialog = page.getByRole('alertdialog', { name: 'Start import apply?' });
      await applyDialog.waitFor();
      await applyDialog.getByLabel(
        'I understand this will move files from staging into the music library. This cannot be undone.',
      ).check();
      await applyDialog.getByRole('textbox').fill('start import apply');
      await applyDialog.getByRole('button', { name: 'Confirm' }).click();

      await waitForHash(page, '#import-apply-run-panel');
      await applyPanel.getByText('Run apply-run-1', { exact: true }).waitFor();
      await applyPanel.getByText('Import apply run apply-run-1 queued for 1 candidate.', {
        exact: true,
      }).waitFor();

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.importReviewApplySummary.currentRun.id, 'apply-run-1');
      assert.deepEqual(
        fixtureState.importReviewRunActions.map((action) => action.action),
        ['apply-start'],
      );

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_completed_download_apply_handoff',
    });
  });

  test('admins can open Library from a completed import apply run', {
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

      const { applyRun, candidate, workspace } = buildCompletedImportApplyWorkspace();
      await installMetadataBrowserFixtures(browserContext);
      await installLibraryBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedMetadataImportReviewWorkspace(page, workspace);

      await page.goto(
        `${baseUrl}/app/activity/candidates?candidate=${candidate.id}&status=applied&applyRunId=${applyRun.id}#import-apply-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();

      const applyPanel = getRunwayPanel(page, 'Move downloads to library');
      await applyPanel.getByText('Run apply-run-tomorrows-harvest-completed', { exact: true }).waitFor();
      await applyPanel.getByText('1 release is in the library', { exact: true }).waitFor();
      await applyPanel.getByText(
        'Open Library to confirm the newly imported release in the complete library view.',
        { exact: true },
      ).waitFor();

      const libraryResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/api/v1/library/releases'
          && url.searchParams.get('status') === 'complete';
      });
      await applyPanel.getByRole('link', { name: 'Open Library' }).click();
      await libraryResponse;
      await page.waitForURL((url) =>
        url.pathname === '/app/library'
        && url.searchParams.get('focus') === 'library'
        && url.searchParams.get('status') === 'complete',
      );

      await page.getByRole('heading', { name: 'Library' }).waitFor();
      await page.getByRole('button', { name: 'Remove filter: Status In Library' }).waitFor();
      const libraryList = page.getByRole('list', { name: 'Library releases' });
      await libraryList.getByText('Tomorrow\'s Harvest').waitFor();
      await libraryList.getByText('Boards of Canada').first().waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_apply_library_handoff',
    });
  });
});
