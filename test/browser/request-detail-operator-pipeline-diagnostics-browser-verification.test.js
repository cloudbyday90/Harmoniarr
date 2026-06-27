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
  seedMetadataMediaRequestEvents,
  seedMetadataMediaRequestPipeline,
  updateMetadataMediaRequest,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  openRequestConfirmationFromCard,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

async function createAdminRequest({ baseUrl, browserContext, page }) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });

  const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
  const confirmRequestDialog = await openRequestConfirmationFromCard(
    page,
    releasesList,
    'Music Has the Right to Children',
  );
  await confirmRequestDialog.getByLabel('Request for').selectOption('fixture-listener-user');
  await confirmRequestDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
  await confirmRequestDialog.waitFor({ state: 'hidden' });

  const fixtureState = await readMetadataBrowserFixtureState(page);
  assert.equal(fixtureState.mediaRequests.length, 1);

  return {
    requestId: fixtureState.mediaRequests[0].id,
  };
}

suite('Operator Request Detail pipeline diagnostics browser verification', () => {
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

  test('admins can inspect pipeline diagnostics and open import review drill-through', {
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

      const { requestId } = await createAdminRequest({ baseUrl, browserContext, page });
      await updateMetadataMediaRequest(page, requestId, {
        fulfillmentStatus: {
          code: 'import_failed',
          detail: 'Import failed; operator review is required.',
          label: 'Import failed',
          occurredAt: '2026-06-25T17:08:00.000Z',
          tone: 'failed',
        },
        requestState: 'failed',
      });
      await seedMetadataMediaRequestPipeline(page, requestId, {
        candidates: [
          {
            apply: {
              finishedAt: '2026-06-25T17:08:00.000Z',
              importCandidateId: 'candidate-private',
              itemStatus: 'failed',
              operationRunId: 'apply-run-private',
              runErrorMessage: '/private/staging/Boards of Canada/private-track.flac failed validation',
              runStatus: 'failed',
              startedAt: '2026-06-25T17:06:00.000Z',
              statusMessage: 'Import validation failed for remote-peer',
            },
            candidateType: 'manual_search',
            execution: {
              finishedAt: '2026-06-25T17:03:00.000Z',
              importCandidateId: 'candidate-private',
              itemStatus: 'completed',
              operationRunId: 'run-private',
              runErrorMessage: null,
              runStatus: 'completed',
              startedAt: '2026-06-25T17:01:00.000Z',
              statusMessage: 'Downloaded from remote-peer',
            },
            fileCount: 12,
            folderPath: '/private/staging/Boards of Canada/Music Has the Right to Children',
            id: 'candidate-private',
            status: 'failed',
            totalSizeBytes: 104857600,
            username: 'remote-peer',
          },
        ],
      });
      await seedMetadataMediaRequestEvents(page, requestId, {
        events: [
          {
            eventType: 'fulfillment_failed',
            id: 'fixture-event-fulfillment-failed',
            occurredAt: '2026-06-25T17:08:00.000Z',
            reason: 'Import validation failed',
          },
        ],
      });

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', {
        exact: true,
        name: 'Boards of Canada \u2014 Music Has the Right to Children',
      }).waitFor();

      const pipeline = page.getByRole('list', { name: 'Linked import candidates' });
      await pipeline.waitFor();
      const candidate = pipeline.getByRole('listitem').first();
      const candidateSummary = candidate.locator('summary');
      await candidateSummary.getByText('Failed', { exact: true }).waitFor();
      await candidateSummary.getByText('remote-peer - Music Has the Right to Children', {
        exact: true,
      }).waitFor();
      await candidateSummary.focus();
      await assertLocatorFocused(candidateSummary, 'Pipeline candidate summary should be keyboard focusable');
      await candidateSummary.press('Enter');

      await candidate.getByText('/private/staging/Boards of Canada/Music Has the Right to Children', {
        exact: true,
      }).waitFor();
      await candidate.getByText('Downloaded from remote-peer', { exact: true }).waitFor();
      await candidate.getByText('Run run-private', { exact: true }).waitFor();
      await candidate.getByText('Candidate candidate-private', { exact: true }).first().waitFor();
      await candidate.getByText('Import validation failed for remote-peer', { exact: true }).waitFor();
      await candidate.getByText('Run apply-run-private', { exact: true }).waitFor();
      await candidate.getByText('/private/staging/Boards of Canada/private-track.flac failed validation', {
        exact: true,
      }).waitFor();

      const importReviewLink = candidate.getByRole('link', { name: 'Open in import review' });
      await importReviewLink.waitFor();
      await importReviewLink.focus();
      await assertLocatorFocused(importReviewLink, 'Import review drill-through link should be keyboard focusable');
      await importReviewLink.press('Enter');
      await page.getByRole('heading', { exact: true, name: 'Download candidates' }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('candidate'), 'candidate-private');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_operator_pipeline_diagnostics',
    });
  });
});
