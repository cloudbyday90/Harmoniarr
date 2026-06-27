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
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  installMetadataBrowserFixtures,
  queueMetadataImportReviewTransitionFailure,
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { buildImportReviewDiagnosticRunWorkspace } from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const IMPORT_REVIEW_SELECTION_STAGE_ID = 'import-review-selection-stage';
const DIAGNOSTIC_FILE_ID = 'candidate-diagnostics-file-1';
const REPAIR_FAILURE_MESSAGE = 'Diagnostic repair is temporarily locked. Try again after the current import run finishes.';

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

      const workspace = buildImportReviewDiagnosticRunWorkspace();
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
      await waitForSearchParam(page, 'candidateFile', DIAGNOSTIC_FILE_ID);
      await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

      const selectionStage = page.locator(`#${IMPORT_REVIEW_SELECTION_STAGE_ID}`);
      const focusedFile = selectionStage.locator(`[data-import-candidate-file-id="${DIAGNOSTIC_FILE_ID}"]`);
      await focusedFile.waitFor();
      await assertLocatorFocused(focusedFile, 'Diagnostic file should receive focus before failed repair');
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');

      await queueMetadataImportReviewTransitionFailure(page, {
        action: 'reopen',
        importCandidateId: workspace.diagnosticCandidate.id,
        message: REPAIR_FAILURE_MESSAGE,
        status: 409,
      });

      const reopenButton = selectionStage.getByRole('button', { exact: true, name: 'Reopen' });
      await reopenButton.focus();
      await assertLocatorFocused(reopenButton, 'Diagnostic repair action should be keyboard focusable');
      await reopenButton.press('Enter');

      const alert = selectionStage.getByRole('alert').filter({
        hasText: REPAIR_FAILURE_MESSAGE,
      });
      await alert.waitFor();
      await selectionStage.getByText('Selected', { exact: true }).first().waitFor();
      await reopenButton.waitFor();
      await assertLocatorFocused(reopenButton, 'Failed diagnostic repair should return focus to the retry action');
      assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
      await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
      await waitForSearchParam(page, 'candidateFile', DIAGNOSTIC_FILE_ID);
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
