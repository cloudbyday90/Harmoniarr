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
  await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();
  await page.getByText('Operator runway', { exact: true }).waitFor();
}

suite('Import Review diagnostic repair retry-success browser verification', () => {
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

  test('admins can retry a failed diagnostic repair and keep diagnostic context after success', {
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

      const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
      await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
      await mediaPanel
        .getByRole('table', { name: 'Media inspection file diagnostics' })
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
      await assertLocatorFocused(focusedFile, 'Diagnostic file should receive focus before repair retry');

      await queueMetadataImportReviewTransitionFailure(page, {
        action: 'reopen',
        importCandidateId: workspace.diagnosticCandidate.id,
        message: IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.repairFailureMessage,
        status: 409,
      });

      const reopenButton = selectionStage.getByRole('button', { exact: true, name: 'Reopen' });
      await reopenButton.focus();
      await reopenButton.press('Enter');

      const alert = selectionStage.getByRole('alert').filter({
        hasText: IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.repairFailureMessage,
      });
      await alert.waitFor();
      await assertLocatorFocused(reopenButton, 'Failed diagnostic repair should leave retry action focused');

      await reopenButton.press('Enter');

      const actionStatus = selectionStage.getByRole('status').filter({
        hasText: 'Candidate reopened for review.',
      });
      await actionStatus.waitFor();
      await assertLocatorFocused(actionStatus, 'Successful retry should move focus to the status message');
      await assertVisibleFocusOutline(actionStatus, 'Successful retry status should expose a visible focus ring');
      await selectionStage.getByText('Pending', { exact: true }).first().waitFor();
      await selectionStage.getByRole('button', { exact: true, name: 'Hold' }).waitFor();
      await selectionStage.getByRole('button', { exact: true, name: 'Select' }).waitFor();
      assert.equal(await alert.count(), 0);
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId);
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const selectedRunRow = mediaPanel.locator('tbody tr').filter({ hasText: workspace.run.id });
      await selectedRunRow.getByRole('button', { name: 'Selected' }).waitFor();
      assert.equal(await selectedRunRow.getAttribute('aria-selected'), 'true');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_diagnostic_repair_retry_success',
    });
  });
});
