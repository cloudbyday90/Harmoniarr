/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { openImportReviewRunHistory } from '../../testing/browser/import-review-browser-helpers.js';
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  assertLocatorFocused,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  installMetadataBrowserFixtures,
  queueMetadataImportReviewTransitionFailure,
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
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByText('Run history and controls', { exact: true }).waitFor();
}

suite('Import Review diagnostic repair failure-state browser verification', () => {
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

  test('admins keep diagnostic context and retry focus when a diagnostic repair fails', {
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

      await openImportReviewRunHistory(page);

      const mediaPanel = getRunwayPanel(page, 'Check selected matches');
      await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
      const diagnosticsTable = mediaPanel.getByRole('table', {
        name: 'Media inspection file diagnostics',
      });
      await diagnosticsTable
        .locator('tbody tr')
        .filter({ hasText: 'alpha.flac' })
        .getByRole('button', { name: 'Open alpha.flac in candidate detail' })
        .click();

      await waitForHash(page, IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.selectionStageHash);
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId);
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const selectionStage = page.locator(`#${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.selectionStageId}`);
      const focusedFile = selectionStage.locator(
        `[data-import-candidate-file-id="${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId}"]`,
      );
      await focusedFile.waitFor();
      await assertLocatorFocused(focusedFile, 'Diagnostic file should receive focus before failed repair');
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');

      await queueMetadataImportReviewTransitionFailure(page, {
        action: 'reopen',
        importCandidateId: workspace.diagnosticCandidate.id,
        message: IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.repairFailureMessage,
        status: 409,
      });

      const reopenButton = selectionStage.getByRole('button', { exact: true, name: 'Reopen for review' });
      await reopenButton.focus();
      await assertLocatorFocused(reopenButton, 'Diagnostic repair action should be keyboard focusable');
      await reopenButton.press('Enter');

      const alert = selectionStage.getByRole('alert').filter({
        hasText: IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.repairFailureMessage,
      });
      await alert.waitFor();
      await selectionStage.getByText('Selected', { exact: true }).first().waitFor();
      await reopenButton.waitFor();
      await assertLocatorFocused(reopenButton, 'Failed diagnostic repair should return focus to the retry action');
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId);
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);
      assert.equal(await page.getByRole('status').filter({
        hasText: 'Candidate reopened for review.',
      }).count(), 0);

      const selectedRunRow = mediaPanel.locator('tbody tr').filter({ hasText: workspace.run.id });
      await selectedRunRow.getByRole('button', { name: 'Selected' }).waitFor();
      assert.equal(await selectedRunRow.getAttribute('aria-selected'), 'true');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_diagnostic_repair_failure_state',
    });
  });
});
