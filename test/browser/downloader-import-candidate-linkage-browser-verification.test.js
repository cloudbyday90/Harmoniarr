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
  buildImportReviewCandidate,
  buildImportReviewPreview,
} from '../../testing/browser/import-review-browser-helpers.js';
import { installDownloaderBrowserFixtures } from '../../testing/browser/downloader-browser-fixtures.js';
import {
  installMetadataBrowserFixtures,
  seedMetadataImportReviewWorkspace,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const linkedCandidate = buildImportReviewCandidate({
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
  normalizedPayload: {
    extensions: ['flac'],
  },
  sourceSearchId: 'search-discovery-dispatch-amber',
  status: 'downloading',
  totalSizeBytes: 54316224,
  username: 'healthy-slskd-peer',
});

let browserRuntime;
let runtimeUnavailableReason = null;

async function seedLinkedCandidateWorkspace(page) {
  await seedMetadataImportReviewWorkspace(page, {
    candidates: [linkedCandidate],
    previewById: {
      [linkedCandidate.id]: buildImportReviewPreview(linkedCandidate),
    },
  });
}

async function assertCandidateRouteSelected(page) {
  await page.waitForFunction(() => {
    const url = new URL(globalThis.location.href);
    return url.pathname === '/app/activity/diagnostics/matches'
      && url.searchParams.get('candidate') === 'candidate-downloader-linked'
      && url.searchParams.get('status') === 'all';
  });
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByText('/private/staging/Autechre/Amber', { exact: true }).first().waitFor();
  await page.getByText('healthy-slskd-peer', { exact: true }).first().waitFor();
}

suite('Downloader import-candidate linkage browser verification', () => {
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

  test('admins can drill from a linked Downloader row into its Import Review candidate', {
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

      await installMetadataBrowserFixtures(browserContext);
      await installDownloaderBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await seedLinkedCandidateWorkspace(page);

      await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Downloader' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Transfer Queue' }).waitFor();
      await page.getByText('01 Foil.flac', { exact: true }).waitFor();
      await page.getByText('healthy-slskd-peer', { exact: true }).waitFor();
      await page.getByRole('progressbar').waitFor();
      const linkedTransferRow = page.getByRole('row').filter({ hasText: '01 Foil.flac' });

      const rowLink = linkedTransferRow.getByRole('link', { name: 'Open advanced diagnostics' });
      await rowLink.waitFor();
      await rowLink.click();
      await assertCandidateRouteSelected(page);

      await page.goto(`${baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      const refreshedLinkedTransferRow = page.getByRole('row').filter({ hasText: '01 Foil.flac' });
      await refreshedLinkedTransferRow.getByRole('button', { name: 'Details' }).click();
      const dialog = page.locator('.downloader-detail-drawer');
      await dialog.waitFor();
      await dialog.getByText('Linked to Import Review candidate.', { exact: true }).waitFor();
      const drawerLink = dialog.getByRole('link', { name: 'Open advanced diagnostics' });
      await drawerLink.waitFor();
      await drawerLink.click();
      await assertCandidateRouteSelected(page);

      assert.deepEqual(pageErrors, []);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'downloader_import_candidate_linkage_handoff',
    });
  });
});
