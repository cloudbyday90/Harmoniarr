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
  queueMetadataImportReviewRunFailure,
  readMetadataBrowserFixtureState,
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  buildImportReviewCandidate,
  buildImportReviewPreview,
  openImportReviewRunHistory,
  seedImportReviewCandidateWorkspace,
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
}) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  await seedMetadataImportReviewWorkspace(page, workspace);
  await page.goto(`${baseUrl}/app/activity/candidates`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByText('Run history and controls', { exact: true }).waitFor();
}

suite('Import Review operator runway controls browser verification', () => {
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

  test('admins only see enabled runway starts after eligible candidate state exists', {
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

      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace: { candidates: [] },
      });

      const runwayDisclosure = page.locator('details.import-review-runway');
      assert.equal(await runwayDisclosure.evaluate((element) => element.open), false);
      await openImportReviewRunHistory(page);

      const mediaInspectionPanel = getRunwayPanel(page, 'Check selected matches');
      const executionPanel = getRunwayPanel(page, 'Send selected matches to downloads');
      const applyPanel = getRunwayPanel(page, 'Add downloads to library');

      await page.getByText('No matches selected yet.', { exact: true }).waitFor();
      await page.getByText('No downloads ready to add.', { exact: true }).waitFor();
      assert.equal(
        await mediaInspectionPanel.getByRole('button', { name: 'Start media inspection' }).isDisabled(),
        true,
      );
      assert.equal(
        await executionPanel.getByRole('button', { name: 'Start download run' }).isDisabled(),
        true,
      );
      assert.equal(
        await applyPanel.getByRole('button', { name: 'Add downloads' }).isDisabled(),
        true,
      );

      const selectedCandidate = buildImportReviewCandidate({
        id: 'candidate-runway-selected',
        status: 'selected',
      });
      await seedImportReviewCandidateWorkspace(page, { candidate: selectedCandidate });
      await page.goto(`${baseUrl}/app/activity/candidates?candidate=${selectedCandidate.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByText('1 selected match ready for download.', { exact: true }).waitFor();
      await openImportReviewRunHistory(page);

      const mediaStart = mediaInspectionPanel.getByRole('button', { name: 'Start media inspection' });
      assert.equal(await mediaStart.isEnabled(), true);
      await mediaStart.click();
      await waitForHash(page, '#import-media-inspection-run-panel');
      await mediaInspectionPanel.getByText('Run media-inspection-run-1', { exact: true }).waitFor();
      await mediaInspectionPanel.getByText(
        'Media check run media-inspection-run-1 queued for 1 selected match.',
        { exact: true },
      ).waitFor();
      assert.equal(await mediaStart.isDisabled(), true);

      const executionStart = executionPanel.getByRole('button', { name: 'Start download run' });
      assert.equal(await executionStart.isEnabled(), true);
      await executionStart.click();
      await waitForHash(page, '#import-execution-run-panel');
      await executionPanel.getByText('Run execution-run-1', { exact: true }).waitFor();
      await executionPanel.getByText(
        'Download run execution-run-1 queued for 1 selected match.',
        { exact: true },
      ).waitFor();
      assert.equal(await executionStart.isDisabled(), true);

      await executionPanel.getByRole('button', { name: 'Sync transfer state' }).click();
      await executionPanel.getByText('Download transfer state synced manually.', { exact: true }).waitFor();
      await executionPanel.getByText('Reconciled automatically', { exact: true }).waitFor();

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.deepEqual(
        fixtureState.importReviewRunActions.map((action) => action.action),
        ['media-inspection-start', 'execution-start', 'execution-reconcile'],
      );
      assert.equal(fixtureState.importReviewMediaInspectionSummary.currentRun.id, 'media-inspection-run-1');
      assert.equal(fixtureState.importReviewExecutionSummary.currentRun.id, 'execution-run-1');
      assert.equal(fixtureState.importReviewExecutionSummary.summary.heartbeat.state.lastOutcome, 'started');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_operator_runway_selected_start_and_reconcile',
    });
  });

  test('admins confirm import apply starts and see execution start failures as alerts', {
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

      const importPendingCandidate = buildImportReviewCandidate({
        id: 'candidate-runway-import-pending',
        status: 'import_pending',
      });
      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace: {
          candidates: [importPendingCandidate],
          previewById: {
            [importPendingCandidate.id]: buildImportReviewPreview(importPendingCandidate),
          },
        },
      });
      await page.goto(`${baseUrl}/app/activity/candidates?candidate=${importPendingCandidate.id}&status=import_pending`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByText('1 download is waiting to add.', { exact: true }).waitFor();

      await openImportReviewRunHistory(page);

      const applyPanel = getRunwayPanel(page, 'Add downloads to library');
      const applyStart = applyPanel.getByRole('button', { name: 'Add downloads' });
      assert.equal(await applyStart.isEnabled(), true);
      await applyStart.click();

      const applyDialog = page.getByRole('alertdialog', { name: 'Add downloads to library?' });
      await applyDialog.waitFor();
      const confirmButton = applyDialog.getByRole('button', { name: 'Confirm' });
      assert.equal(await confirmButton.isDisabled(), true);
      await applyDialog.getByLabel(
        'I understand this will move files from staging into the music library. This cannot be undone.',
      ).check();
      await applyDialog.getByRole('textbox').fill('add downloads');
      assert.equal(await confirmButton.isEnabled(), true);
      await confirmButton.click();
      await waitForHash(page, '#import-apply-run-panel');
      await applyPanel.getByText('Run apply-run-1', { exact: true }).waitFor();
      await applyPanel.getByText('Add-to-library run apply-run-1 queued for 1 download.', {
        exact: true,
      }).waitFor();
      const applyStartedState = await readMetadataBrowserFixtureState(page);

      const selectedCandidate = buildImportReviewCandidate({
        id: 'candidate-runway-failure',
        status: 'selected',
      });
      await seedMetadataImportReviewWorkspace(page, {
        applySummary: applyStartedState.importReviewApplySummary,
        candidates: [selectedCandidate],
        previewById: {
          [selectedCandidate.id]: buildImportReviewPreview(selectedCandidate),
        },
        runActions: applyStartedState.importReviewRunActions,
      });
      await queueMetadataImportReviewRunFailure(page, {
        action: 'execution-start',
        code: 'maintenance_lock_conflict',
        message: 'Download execution is paused by a maintenance lock.',
        status: 409,
      });
      await page.goto(`${baseUrl}/app/activity/candidates?candidate=${selectedCandidate.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByText('1 selected match ready for download.', { exact: true }).waitFor();

      await openImportReviewRunHistory(page);

      const executionPanel = getRunwayPanel(page, 'Send selected matches to downloads');
      await executionPanel.getByRole('button', { name: 'Start download run' }).click();
      await waitForHash(page, '#import-execution-run-panel');
      await page.getByRole('alert').filter({
        hasText: 'Download execution is paused by a maintenance lock.',
      }).waitFor();
      assert.equal(
        await executionPanel.getByRole('button', { name: 'Start download run' }).isEnabled(),
        true,
      );

      const fixtureState = await readMetadataBrowserFixtureState(page);
      assert.equal(fixtureState.importReviewApplySummary.currentRun.id, 'apply-run-1');
      assert.deepEqual(
        fixtureState.importReviewRunActions.map((action) => action.action),
        ['apply-start'],
      );

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_operator_runway_apply_confirm_and_execution_failure',
    });
  });
});
