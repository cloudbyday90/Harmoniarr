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

function buildHistoricalRunWorkspace() {
  const mediaCurrent = buildImportReviewMediaInspectionRun({
    currentStep: 'Current media inspection run summary is available.',
    id: 'media-inspection-run-current',
    inspectedFileCount: 6,
    startedAt: '2026-06-25T18:00:00.000Z',
  });
  const mediaHistorical = buildImportReviewMediaInspectionRun({
    currentStep: 'Historical media inspection run detail loaded from the selected URL.',
    id: 'media-inspection-run-historical',
    inspectedFileCount: 9,
    startedAt: '2026-06-24T18:00:00.000Z',
    warningCount: 2,
  });

  const executionCurrent = buildImportReviewExecutionRun({
    currentStep: 'Current download run summary is available.',
    id: 'execution-run-current',
    queuedCount: 4,
    startedAt: '2026-06-25T19:00:00.000Z',
  });
  const executionHistorical = buildImportReviewExecutionRun({
    currentStep: 'Historical download run detail loaded from recent history.',
    id: 'execution-run-historical',
    queuedCount: 3,
    queuedWithWarningsCount: 1,
    startedAt: '2026-06-24T19:00:00.000Z',
  });

  const applyCurrent = buildImportReviewApplyRun({
    appliedCount: 2,
    currentStep: 'Current import apply run summary is available.',
    id: 'apply-run-current',
    startedAt: '2026-06-25T20:00:00.000Z',
  });
  const applyHistorical = buildImportReviewApplyRun({
    appliedCount: 1,
    appliedWithWarningsCount: 1,
    currentStep: 'Historical import apply run detail loaded from recent history.',
    id: 'apply-run-historical',
    startedAt: '2026-06-24T20:00:00.000Z',
  });

  return {
    applySummary: buildImportReviewRunSummary({
      currentRun: applyCurrent,
      recentRuns: [applyHistorical, applyCurrent],
      summary: {
        message: 'Import apply history is ready.',
      },
    }),
    executionSummary: buildImportReviewRunSummary({
      currentRun: executionCurrent,
      recentRuns: [executionHistorical, executionCurrent],
      summary: {
        heartbeat: {
          intervalLabel: 'Manual fixture',
          source: 'browser fixture',
          state: {
            lastOutcome: 'completed',
            lastSkipReason: null,
            lastTickAt: '2026-06-25T19:05:00.000Z',
            lastTransitionCount: 3,
          },
        },
        message: 'Download run history is ready.',
        missingTransferPolicy: {
          gracePeriodLabel: 'Manual fixture',
        },
      },
    }),
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun: mediaCurrent,
      recentRuns: [mediaHistorical, mediaCurrent],
      summary: {
        message: 'Media inspection history is ready.',
      },
    }),
    runs: {
      applyCurrent,
      applyHistorical,
      executionCurrent,
      executionHistorical,
      mediaCurrent,
      mediaHistorical,
    },
  };
}

async function assertSelectedRunDetail({
  page,
  panelHeading,
  run,
}) {
  const panel = getRunwayPanel(page, panelHeading);
  await panel.getByText(`Run ${run.id}`, { exact: true }).waitFor();
  await panel.getByText(run.currentStep, { exact: true }).waitFor();
  const selectedRow = panel.locator('tbody tr').filter({ hasText: run.id });
  await selectedRow.getByRole('button', { name: 'Selected' }).waitFor();
  assert.equal(await selectedRow.getAttribute('aria-selected'), 'true');
  return panel;
}

suite('Import Review selected-run deep-link browser verification', () => {
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

  test('admins can deep-link directly to historical runway run details', {
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

      const workspace = buildHistoricalRunWorkspace();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix: `?mediaInspectionRunId=${workspace.runs.mediaHistorical.id}#import-media-inspection-run-panel`,
      });

      await waitForHash(page, '#import-media-inspection-run-panel');
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Inspect selected candidate media',
        run: workspace.runs.mediaHistorical,
      });
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.runs.mediaHistorical.id);

      await page.goto(
        `${baseUrl}/app/activity/candidates?executionRunId=${workspace.runs.executionHistorical.id}#import-execution-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await waitForHash(page, '#import-execution-run-panel');
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Queue selected for download',
        run: workspace.runs.executionHistorical,
      });
      await waitForSearchParam(page, 'executionRunId', workspace.runs.executionHistorical.id);

      await page.goto(
        `${baseUrl}/app/activity/candidates?applyRunId=${workspace.runs.applyHistorical.id}#import-apply-run-panel`,
        { waitUntil: 'domcontentloaded' },
      );
      await waitForHash(page, '#import-apply-run-panel');
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Move downloads to library',
        run: workspace.runs.applyHistorical,
      });
      await waitForSearchParam(page, 'applyRunId', workspace.runs.applyHistorical.id);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_selected_run_direct_deep_links',
    });
  });

  test('admins can select historical runs from recent history and preserve selection on refresh', {
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

      const workspace = buildHistoricalRunWorkspace();
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
      });

      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.runs.mediaCurrent.id}`, { exact: true }).waitFor();
      await mediaPanel
        .locator('tbody tr')
        .filter({ hasText: workspace.runs.mediaHistorical.id })
        .getByRole('button', { name: 'View' })
        .click();
      await waitForHash(page, '#import-media-inspection-run-panel');
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.runs.mediaHistorical.id);
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Inspect selected candidate media',
        run: workspace.runs.mediaHistorical,
      });

      await mediaPanel.getByRole('button', { name: 'Refresh' }).click();
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Inspect selected candidate media',
        run: workspace.runs.mediaHistorical,
      });

      const executionPanel = getRunwayPanel(page, 'Queue selected for download');
      await executionPanel
        .locator('tbody tr')
        .filter({ hasText: workspace.runs.executionHistorical.id })
        .getByRole('button', { name: 'View' })
        .click();
      await waitForHash(page, '#import-execution-run-panel');
      await waitForSearchParam(page, 'executionRunId', workspace.runs.executionHistorical.id);
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Queue selected for download',
        run: workspace.runs.executionHistorical,
      });

      const applyPanel = getRunwayPanel(page, 'Move downloads to library');
      await applyPanel
        .locator('tbody tr')
        .filter({ hasText: workspace.runs.applyHistorical.id })
        .getByRole('button', { name: 'View' })
        .click();
      await waitForHash(page, '#import-apply-run-panel');
      await waitForSearchParam(page, 'applyRunId', workspace.runs.applyHistorical.id);
      await assertSelectedRunDetail({
        page,
        panelHeading: 'Move downloads to library',
        run: workspace.runs.applyHistorical,
      });

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_selected_run_history_selection',
    });
  });
});
