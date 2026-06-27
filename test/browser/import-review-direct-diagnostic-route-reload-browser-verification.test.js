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
  buildDirectDiagnosticRouteSuffix,
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

async function assertDirectDiagnosticRouteHydrated({
  page,
  workspace,
}) {
  await waitForHash(page, IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.selectionStageHash);
  await waitForSearchParam(page, 'candidate', workspace.diagnosticCandidate.id);
  await waitForSearchParam(page, 'candidateFile', IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId);
  await waitForSearchParam(page, 'mediaInspectionRunId', workspace.run.id);

  const selectionStage = page.locator(`#${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.selectionStageId}`);
  await selectionStage.getByRole('heading', { exact: true, name: 'Files and actions' }).waitFor();
  await selectionStage.getByRole('heading', { exact: true, name: workspace.diagnosticCandidate.folderPath }).waitFor();
  await selectionStage.getByText(workspace.diagnosticCandidate.username, { exact: true }).waitFor();
  await selectionStage.getByText(IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFilename, { exact: true }).waitFor();
  await selectionStage.getByRole('button', { exact: true, name: 'Reopen' }).waitFor();

  const focusedFile = selectionStage.locator(
    `[data-import-candidate-file-id="${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId}"]`,
  );
  await focusedFile.waitFor();
  assert.equal(await focusedFile.getAttribute('data-focused'), 'true');
  await assertLocatorFocused(focusedFile, 'Direct diagnostic route should focus the affected file row');
  await assertVisibleFocusOutline(focusedFile, 'Direct diagnostic route should expose a visible file focus ring');

  const mediaPanel = getRunwayPanel(page, 'Inspect selected candidate media');
  await mediaPanel.getByText(`Run ${workspace.run.id}`, { exact: true }).waitFor();
  const selectedRunRow = mediaPanel.locator('tbody tr').filter({ hasText: workspace.run.id });
  await selectedRunRow.getByRole('button', { name: 'Selected' }).waitFor();
  assert.equal(await selectedRunRow.getAttribute('aria-selected'), 'true');
}

suite('Import Review direct diagnostic route reload browser verification', () => {
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

  test('admins can reload a direct diagnostic candidate route without losing file or run context', {
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
      const urlSuffix = buildDirectDiagnosticRouteSuffix(workspace);

      await openImportReviewForAdmin({
        baseUrl,
        browserContext,
        page,
        workspace,
        urlSuffix,
      });

      await assertDirectDiagnosticRouteHydrated({ page, workspace });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();
      await assertDirectDiagnosticRouteHydrated({ page, workspace });

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_direct_diagnostic_route_reload',
    });
  });
});
