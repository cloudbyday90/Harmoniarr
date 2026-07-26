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
  buildImportReviewCandidate,
  buildImportReviewPreview,
} from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function buildBlockedImportReadinessWorkspace() {
  const candidate = buildImportReviewCandidate({
    folderPath: '@@hwkur\\SOULSEEK INCOMING\\How Can It Be (2015)',
    id: 'candidate-import-path-blocked',
    importPendingAt: '2026-06-28T17:52:00.000Z',
    importStatus: {
      code: 'blocked',
      message: '12 files are missing from the resolved source path and block import apply.',
    },
    planning: {
      libraryFolderPath: '/data/music/Lauren Daigle/How Can It Be (2015)',
      primaryBlocker: 'The expected source file is not reachable from the resolved download path.',
      primaryWarning: null,
      resolutionStrategy: 'downloads_root_relative',
      sourceFolderPath: '/data/downloads/@@hwkur/SOULSEEK INCOMING/How Can It Be (2015)',
      stagingFolderPath: '/data/staging/import-candidates/candidate-import-path-blocked/Lauren Daigle/How Can It Be (2015)',
    },
    sourceProvider: 'slskd',
    status: 'import_pending',
    username: 'Lazza13',
  });

  return {
    candidate,
    workspace: {
      candidates: [candidate],
      previewById: {
        [candidate.id]: buildImportReviewPreview(candidate),
      },
    },
  };
}

suite('Activity Imports import-readiness browser verification', () => {
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

  test('admins can see blocked library-add diagnostics and open the match repair workspace', {
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

      const { candidate, workspace } = buildBlockedImportReadinessWorkspace();
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedMetadataImportReviewWorkspace(page, workspace);

      await page.goto(`${baseUrl}/app/activity/imports`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => globalThis.location.pathname === '/app/activity/diagnostics/library-adds');
      await page.getByRole('heading', { exact: true, name: 'Library-add diagnostics' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Import readiness' }).waitFor();
      await page.getByText(
        '1 completed download candidate is blocked and needs operator attention before import apply can proceed.',
        { exact: true },
      ).waitFor();
      await page.getByText('Import pending').waitFor();
      await page.getByRole('table').getByText('Blocked', { exact: true }).waitFor();
      await page.getByText('12 files are missing from the resolved source path and block import apply.', {
        exact: true,
      }).waitFor();
      await page.getByText('/data/downloads/@@hwkur/SOULSEEK INCOMING/How Can It Be (2015)', {
        exact: true,
      }).waitFor();
      await page.getByRole('link', { name: 'Check path mappings' }).waitFor();

      await page.getByRole('link', { name: 'Open diagnostics' }).click();
      await page.waitForFunction((candidateId) => {
        const url = new URL(globalThis.location.href);
        return url.pathname === '/app/activity/diagnostics/matches'
          && url.searchParams.get('candidate') === candidateId
          && url.searchParams.get('status') === 'import_pending'
          && url.hash === '#import-review-selection-stage';
      }, candidate.id);
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      await page.getByText(candidate.folderPath, { exact: true }).first().waitFor();
      await page.getByText('Match details and exceptions', { exact: true }).waitFor();

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'activity_imports_import_readiness_handoff',
    });
  });
});
